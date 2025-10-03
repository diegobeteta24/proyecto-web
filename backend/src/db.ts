let _mysql: any = null
async function ensureMysql(): Promise<any> {
  if (!_mysql) {
    _mysql = await import('mysql2/promise')
  }
  return _mysql
}

const DB_HOST = process.env.DB_HOST ?? '127.0.0.1'
const DB_PORT = Number(process.env.DB_PORT ?? '3306')
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASS = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'votaciones'

export async function getPool() {
  // create database if not exists, then return pool connected to DB_NAME
  const { createConnection } = await ensureMysql()
  const root = await createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, multipleStatements: true })
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
  await root.end()
  const { createPool } = await ensureMysql()
  const pool = createPool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, database: DB_NAME, waitForConnections: true, connectionLimit: 10, namedPlaceholders: true })
  return pool
}

export async function migrate() {
  const pool = await getPool()
  // NOTE: voters table has been merged into engineers. We keep migration helpers below to move data if an old voters table exists.

  // campaigns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(200) NOT NULL,
      descripcion TEXT NULL,
      votos_por_votante INT NOT NULL DEFAULT 1,
      habilitada TINYINT(1) NOT NULL DEFAULT 0,
      inicia_en DATETIME NOT NULL,
      termina_en DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (habilitada),
      INDEX (inicia_en),
      INDEX (termina_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // engineers roster (authorized colegiados)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS engineers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegiado VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(200) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (activo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  // Try to drop legacy 'rol' column and its index if they exist
  try {
    await pool.query('ALTER TABLE engineers DROP COLUMN rol')
  } catch (e) {
    // ignore if column didn't exist
  }
  try {
    // If the index was created with default name equal to column, attempt drop
    await pool.query('DROP INDEX rol ON engineers')
  } catch (e) {
    // ignore if index didn't exist or already dropped with column
  }
  // Add credential fields to engineers (from old voters table)
  try { await pool.query('ALTER TABLE engineers ADD COLUMN email VARCHAR(200) NULL') } catch {}
  try { await pool.query('ALTER TABLE engineers ADD COLUMN dpi VARCHAR(20) NULL') } catch {}
  try { await pool.query('ALTER TABLE engineers ADD COLUMN fecha_nacimiento DATE NULL') } catch {}
  try { await pool.query('ALTER TABLE engineers ADD COLUMN password_hash VARCHAR(255) NULL') } catch {}
  try { await pool.query('ALTER TABLE engineers ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0') } catch {}
  // Unique indexes for new fields (allow multiple NULLs by default in MySQL)
  try { await pool.query('CREATE UNIQUE INDEX uq_engineers_email ON engineers(email)') } catch {}
  try { await pool.query('CREATE UNIQUE INDEX uq_engineers_dpi ON engineers(dpi)') } catch {}
  try { await pool.query('CREATE INDEX idx_engineers_is_admin ON engineers(is_admin)') } catch {}
  try { await pool.query('CREATE UNIQUE INDEX uq_engineers_nombre ON engineers(nombre)') } catch {}

  // candidates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      bio TEXT NULL,
      foto_url VARCHAR(500) NULL,
      engineer_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  // Add engineer_id FK and unique index if missing
  try { await pool.query('ALTER TABLE candidates ADD COLUMN engineer_id INT NULL') } catch {}
  try { await pool.query('ALTER TABLE candidates ADD CONSTRAINT fk_candidates_engineer FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE SET NULL') } catch {}
  try { await pool.query('CREATE UNIQUE INDEX uq_candidates_engineer ON candidates(engineer_id)') } catch {}

  // campaign_candidates (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_candidates (
      campaign_id INT NOT NULL,
      candidate_id INT NOT NULL,
      bio TEXT NULL,
      PRIMARY KEY (campaign_id, candidate_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  // Add bio column to campaign_candidates if it doesn't exist
  try { await pool.query('ALTER TABLE campaign_candidates ADD COLUMN bio TEXT NULL') } catch {}

  // votes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      candidate_id INT NOT NULL,
      voter_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES engineers(id) ON DELETE CASCADE,
      UNIQUE KEY uq_vote_once (campaign_id, voter_id, candidate_id),
      INDEX (campaign_id, voter_id),
      INDEX (campaign_id, candidate_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Migration: if old voters table exists, move credentials into engineers and retarget votes
  try {
    const [tables]: any = await pool.query("SHOW TABLES LIKE 'voters'")
    if (Array.isArray(tables) && tables.length > 0) {
      // Upsert missing engineers from voters
      await pool.query(`
        INSERT INTO engineers (colegiado, nombre, email, dpi, fecha_nacimiento, password_hash, activo)
        SELECT v.colegiado, v.nombre, v.email, v.dpi, v.fecha_nacimiento, v.password_hash, v.activo
        FROM voters v
        LEFT JOIN engineers e ON e.colegiado = v.colegiado
        WHERE e.id IS NULL;
      `)
      // Update existing engineers with voter credentials where missing
      await pool.query(`
        UPDATE engineers e
        INNER JOIN voters v ON v.colegiado = e.colegiado
        SET e.email = COALESCE(e.email, v.email),
            e.dpi = COALESCE(e.dpi, v.dpi),
            e.fecha_nacimiento = COALESCE(e.fecha_nacimiento, v.fecha_nacimiento),
            e.password_hash = COALESCE(e.password_hash, v.password_hash),
            e.activo = CASE WHEN e.activo IS NULL THEN v.activo ELSE e.activo END;
      `)
      // Rebuild votes table to reference engineers, remapping voter ids via colegiado
      // First, create a temp table with correct FKs
      await pool.query(`
        CREATE TABLE IF NOT EXISTS votes_new (
          id INT AUTO_INCREMENT PRIMARY KEY,
          campaign_id INT NOT NULL,
          candidate_id INT NOT NULL,
          voter_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
          FOREIGN KEY (voter_id) REFERENCES engineers(id) ON DELETE CASCADE,
          UNIQUE KEY uq_vote_once (campaign_id, voter_id, candidate_id),
          INDEX (campaign_id, voter_id),
          INDEX (campaign_id, candidate_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `)
      // Copy rows with id remap (voters.id -> engineers.id via colegiado)
      await pool.query(`
        INSERT IGNORE INTO votes_new (id, campaign_id, candidate_id, voter_id, created_at)
        SELECT vts.id, vts.campaign_id, vts.candidate_id, e.id as voter_id, vts.created_at
        FROM votes vts
        INNER JOIN voters vt ON vt.id = vts.voter_id
        INNER JOIN engineers e ON e.colegiado = vt.colegiado;
      `)
      // Replace old votes table
      await pool.query('RENAME TABLE votes TO votes_old')
      await pool.query('RENAME TABLE votes_new TO votes')
      try { await pool.query('DROP TABLE votes_old') } catch {}
      // Finally, drop old voters table
      try { await pool.query('DROP TABLE voters') } catch {}
    }
  } catch (e) {
    // If migration fails, leave existing data; log on caller
  }
}

export type VoterRow = {
  id: number
  colegiado: string
  nombre: string
  email: string
  dpi: string
  fecha_nacimiento: string
  password_hash: string
}
