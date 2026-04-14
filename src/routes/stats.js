const db = require('../db');
const authenticate = require('../middleware/auth');

async function statsRoutes(fastify) {
  // 所有统计路由需要认证
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/stats/overview — 总览统计
  fastify.get('/api/v1/stats/overview', async () => {
    const result = await db.query(`
      SELECT
        COUNT(DISTINCT t.id) AS total_trips,
        COUNT(c.id) AS total_catches,
        COUNT(DISTINCT c.species) AS total_species,
        COALESCE(ROUND(SUM(c.weight_g) / 1000.0, 2), 0) AS total_weight_kg
      FROM fishing_trips t
      LEFT JOIN fish_catches c ON c.trip_id = t.id
    `);

    const row = result.rows[0];
    return {
      success: true,
      data: {
        total_trips: parseInt(row.total_trips, 10),
        total_catches: parseInt(row.total_catches, 10),
        total_species: parseInt(row.total_species, 10),
        total_weight_kg: parseFloat(row.total_weight_kg),
      },
    };
  });

  // GET /api/v1/stats/seasonal — 按月出行次数
  fastify.get('/api/v1/stats/seasonal', async (request) => {
    const year = parseInt(request.query.year, 10) || new Date().getFullYear();

    const result = await db.query(
      `SELECT EXTRACT(MONTH FROM trip_date)::int AS month, COUNT(*)::int AS count
       FROM fishing_trips
       WHERE EXTRACT(YEAR FROM trip_date) = $1
       GROUP BY month ORDER BY month`,
      [year]
    );

    // 补齐12个月，无数据的月份填0
    const monthMap = {};
    for (const row of result.rows) {
      monthMap[row.month] = row.count;
    }
    const months = [];
    for (let i = 1; i <= 12; i++) {
      months.push({ month: i, count: monthMap[i] || 0 });
    }

    return { success: true, data: { year, months } };
  });

  // GET /api/v1/stats/species — 鱼种分布
  fastify.get('/api/v1/stats/species', async () => {
    const result = await db.query(`
      SELECT c.species AS name, COUNT(*)::int AS count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS percentage
      FROM fish_catches c
      JOIN fishing_trips t ON t.id = c.trip_id
      WHERE c.species IS NOT NULL
      GROUP BY c.species ORDER BY count DESC
    `);

    return {
      success: true,
      data: result.rows.map((r) => ({
        name: r.name,
        count: r.count,
        percentage: parseFloat(r.percentage),
      })),
    };
  });

  // GET /api/v1/stats/top-catches — 最大渔获 Top 10
  fastify.get('/api/v1/stats/top-catches', async () => {
    const result = await db.query(`
      SELECT c.species AS fish_species,
        ROUND(c.weight_g / 1000.0, 2) AS weight_kg,
        t.trip_date
      FROM fish_catches c
      JOIN fishing_trips t ON t.id = c.trip_id
      WHERE c.weight_g IS NOT NULL
      ORDER BY c.weight_g DESC LIMIT 10
    `);

    return {
      success: true,
      data: result.rows.map((r) => ({
        fish_species: r.fish_species,
        weight_kg: parseFloat(r.weight_kg),
        trip_date: r.trip_date,
      })),
    };
  });
}

module.exports = statsRoutes;
