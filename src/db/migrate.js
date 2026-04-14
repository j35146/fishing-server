const db = require('./index');

// 数据库迁移：按依赖顺序建表
async function migrate() {
  // users 表
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username      VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 钓法表
  await db.query(`
    CREATE TABLE IF NOT EXISTS fishing_styles (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(20) NOT NULL,
      code VARCHAR(20) NOT NULL
    );
  `);
  // 幂等插入初始数据
  await db.query(`
    INSERT INTO fishing_styles (name, code)
      SELECT '台钓', 'TRADITIONAL'
      WHERE NOT EXISTS (SELECT 1 FROM fishing_styles WHERE code='TRADITIONAL');
  `);
  await db.query(`
    INSERT INTO fishing_styles (name, code)
      SELECT '路亚', 'LURE'
      WHERE NOT EXISTS (SELECT 1 FROM fishing_styles WHERE code='LURE');
  `);

  // 出行记录表
  await db.query(`
    CREATE TABLE IF NOT EXISTS fishing_trips (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title             VARCHAR(100),
      trip_date         DATE NOT NULL,
      start_time        TIMESTAMPTZ,
      end_time          TIMESTAMPTZ,
      location_name     VARCHAR(200),
      spot_id           UUID,
      weather_temp      DECIMAL(4,1),
      weather_wind      VARCHAR(50),
      weather_condition VARCHAR(50),
      companions        TEXT[],
      notes             TEXT,
      sync_status       VARCHAR(20) DEFAULT 'synced',
      local_id          VARCHAR(100) UNIQUE,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 出行-钓法关联表
  await db.query(`
    CREATE TABLE IF NOT EXISTS trip_fishing_styles (
      trip_id  UUID REFERENCES fishing_trips(id) ON DELETE CASCADE,
      style_id INTEGER REFERENCES fishing_styles(id),
      PRIMARY KEY (trip_id, style_id)
    );
  `);

  // 渔获表
  await db.query(`
    CREATE TABLE IF NOT EXISTS fish_catches (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id     UUID REFERENCES fishing_trips(id) ON DELETE CASCADE NOT NULL,
      style_id    INTEGER REFERENCES fishing_styles(id),
      species     VARCHAR(100),
      weight_g    INTEGER,
      length_cm   DECIMAL(5,1),
      count       INTEGER DEFAULT 1,
      is_released BOOLEAN DEFAULT FALSE,
      caught_at   TIMESTAMPTZ,
      notes       TEXT,
      local_id    VARCHAR(100) UNIQUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 装备分类表
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_categories (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(50) NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);
  // 幂等插入预设分类
  await db.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM equipment_categories) THEN
        INSERT INTO equipment_categories (name, sort_order) VALUES
          ('鱼竿',1),('鱼轮',2),('鱼线',3),('鱼钩',4),
          ('鱼饵',5),('浮漂',6),('铅坠',7),('配件',8),('其他',9);
      END IF;
    END $$;
  `);

  // 装备库表
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_library (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id    INTEGER REFERENCES equipment_categories(id),
      name           VARCHAR(100) NOT NULL,
      brand          VARCHAR(100),
      model          VARCHAR(100),
      style_tags     TEXT[],
      purchase_date  DATE,
      purchase_price DECIMAL(10,2),
      status         VARCHAR(20) DEFAULT 'active',
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 出行-装备关联表
  await db.query(`
    CREATE TABLE IF NOT EXISTS trip_equipment (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id      UUID REFERENCES fishing_trips(id) ON DELETE CASCADE,
      equipment_id UUID REFERENCES equipment_library(id),
      notes        TEXT
    );
  `);

  // Phase 2：媒体字段
  await db.query(`ALTER TABLE fishing_trips ADD COLUMN IF NOT EXISTS media_keys JSONB DEFAULT '[]'`);
  await db.query(`ALTER TABLE fish_catches ADD COLUMN IF NOT EXISTS media_keys JSONB DEFAULT '[]'`);
  await db.query(`ALTER TABLE equipment_library ADD COLUMN IF NOT EXISTS photo_key VARCHAR(500)`);

  // Phase 2：钓点表
  await db.query(`
    CREATE TABLE IF NOT EXISTS spots (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      latitude DECIMAL(10,8) NOT NULL,
      longitude DECIMAL(11,8) NOT NULL,
      spot_type VARCHAR(20) NOT NULL DEFAULT 'other'
        CHECK (spot_type IN ('river','lake','reservoir','sea','other')),
      is_public BOOLEAN NOT NULL DEFAULT false,
      photo_key VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('数据库迁移完成');
}

module.exports = migrate;
