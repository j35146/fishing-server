const db = require('../db');
const authenticate = require('../middleware/auth');

// 创建装备 schema
const createEquipmentSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      category_id: { type: 'integer' },
      name: { type: 'string' },
      brand: { type: 'string' },
      model: { type: 'string' },
      style_tags: { type: 'array', items: { type: 'string' } },
      purchase_date: { type: 'string', format: 'date' },
      purchase_price: { type: 'number' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};

// 更新装备 schema
const updateEquipmentSchema = {
  body: {
    type: 'object',
    properties: {
      category_id: { type: 'integer' },
      name: { type: 'string' },
      brand: { type: 'string' },
      model: { type: 'string' },
      style_tags: { type: 'array', items: { type: 'string' } },
      purchase_date: { type: 'string', format: 'date' },
      purchase_price: { type: 'number' },
      status: { type: 'string' },
      notes: { type: 'string' },
    },
  },
};

// 创建分类 schema
const createCategorySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      sort_order: { type: 'integer' },
    },
  },
};

async function equipmentRoutes(fastify) {
  // 所有装备路由需要认证
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/equipment/categories — 获取所有分类（放在参数路由前面）
  fastify.get('/api/v1/equipment/categories', async () => {
    const result = await db.query('SELECT * FROM equipment_categories ORDER BY sort_order');
    return { success: true, data: result.rows };
  });

  // POST /api/v1/equipment/categories — 新建分类
  fastify.post('/api/v1/equipment/categories', { schema: createCategorySchema }, async (request, reply) => {
    const { name, sort_order } = request.body;

    const result = await db.query(
      'INSERT INTO equipment_categories (name, sort_order) VALUES ($1, $2) RETURNING *',
      [name, sort_order || 0]
    );

    reply.code(201);
    return { success: true, data: result.rows[0] };
  });

  // GET /api/v1/equipment — 装备列表（含筛选）
  fastify.get('/api/v1/equipment', async (request) => {
    const { styleTag, status, categoryId, page = 1, pageSize = 20 } = request.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (styleTag) {
      where += ` AND $${paramIndex} = ANY(el.style_tags)`;
      params.push(styleTag);
      paramIndex++;
    }
    if (status) {
      where += ` AND el.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (categoryId) {
      where += ` AND el.category_id = $${paramIndex}`;
      params.push(parseInt(categoryId, 10));
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM equipment_library el ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, pageSize, offset];
    const result = await db.query(
      `SELECT el.*, ec.name AS category_name
       FROM equipment_library el
       LEFT JOIN equipment_categories ec ON ec.id = el.category_id
       ${where}
       ORDER BY el.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      listParams
    );

    return {
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), total },
    };
  });

  // POST /api/v1/equipment — 创建装备
  fastify.post('/api/v1/equipment', { schema: createEquipmentSchema }, async (request, reply) => {
    const { category_id, name, brand, model, style_tags, purchase_date, purchase_price, status, notes } = request.body;

    const result = await db.query(
      `INSERT INTO equipment_library
        (category_id, name, brand, model, style_tags, purchase_date, purchase_price, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [category_id || null, name, brand || null, model || null,
       style_tags || null, purchase_date || null, purchase_price || null,
       status || 'active', notes || null]
    );

    reply.code(201);
    return { success: true, data: result.rows[0] };
  });

  // PUT /api/v1/equipment/:id — 更新装备
  fastify.put('/api/v1/equipment/:id', { schema: updateEquipmentSchema }, async (request, reply) => {
    const { id } = request.params;
    const { category_id, name, brand, model, style_tags, purchase_date, purchase_price, status, notes } = request.body;

    const result = await db.query(
      `UPDATE equipment_library SET
        category_id = COALESCE($1, category_id),
        name = COALESCE($2, name),
        brand = COALESCE($3, brand),
        model = COALESCE($4, model),
        style_tags = COALESCE($5, style_tags),
        purchase_date = COALESCE($6, purchase_date),
        purchase_price = COALESCE($7, purchase_price),
        status = COALESCE($8, status),
        notes = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [category_id, name, brand, model, style_tags, purchase_date, purchase_price, status, notes, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '装备不存在' });
    }

    return { success: true, data: result.rows[0] };
  });

  // DELETE /api/v1/equipment/:id — 删除装备（有引用则禁止）
  fastify.delete('/api/v1/equipment/:id', async (request, reply) => {
    const { id } = request.params;

    // 检查是否被出行引用
    const refResult = await db.query('SELECT COUNT(*) FROM trip_equipment WHERE equipment_id = $1', [id]);
    if (parseInt(refResult.rows[0].count, 10) > 0) {
      return reply.code(400).send({ success: false, error: '该装备已被出行记录引用，无法删除' });
    }

    const result = await db.query('DELETE FROM equipment_library WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '装备不存在' });
    }

    return { success: true, data: { id } };
  });
}

module.exports = equipmentRoutes;
