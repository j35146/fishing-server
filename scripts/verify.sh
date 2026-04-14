#!/bin/bash
# fishing-server · 自动化验证脚本
# 用法：bash scripts/verify.sh
# 说明：每完成一个模块后运行，所有项目必须通过才能继续

BASE_URL="http://localhost:3000"
TOKEN=""
TRIP_ID=""
CATCH_ID=""
EQUIPMENT_ID=""

PASS=0
FAIL=0

# ─── 颜色 ─────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# ─── 等待服务就绪 ─────────────────────────────────────
section "等待服务就绪"
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    pass "服务已启动（/health 返回 200）"
    break
  fi
  echo "  等待服务启动... ($i/15)"
  sleep 2
done
[ "$STATUS" != "200" ] && fail "服务启动超时，请检查 docker compose logs" && exit 1

# ─── 模块一：认证 ─────────────────────────────────────
section "模块：认证"

# R18 登录成功
RESP=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"'"${INIT_USERNAME:-admin}"'","password":"'"${INIT_PASSWORD:-change-me-123}"'"}')
TOKEN=$(echo "$RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] && pass "POST /auth/login → 返回 token" || fail "POST /auth/login → 未返回 token（响应：$RESP）"

# R19 密码错误
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}')
[ "$STATUS" = "401" ] && pass "POST /auth/login 密码错误 → 401" || fail "POST /auth/login 密码错误 → 期望 401，实际 $STATUS"

# R22 未携带 token
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/trips")
[ "$STATUS" = "401" ] && pass "未携带 token → 401" || fail "未携带 token → 期望 401，实际 $STATUS"

# R23 无效 token
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/trips" \
  -H "Authorization: Bearer invalidtoken")
[ "$STATUS" = "401" ] && pass "无效 token → 401" || fail "无效 token → 期望 401，实际 $STATUS"

# ─── 模块二：出行记录 ─────────────────────────────────
section "模块：出行记录"
AUTH_HEADER="Authorization: Bearer $TOKEN"

# R28 创建出行
RESP=$(curl -s -X POST "$BASE_URL/api/v1/trips" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"trip_date":"2026-04-14","title":"验证测试出行","style_ids":[1],"location_name":"测试水库"}')
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
TRIP_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$SUCCESS" ] && [ -n "$TRIP_ID" ] && pass "POST /trips → 创建成功" || fail "POST /trips → 失败（响应：$RESP）"

# R24 查询列表
RESP=$(curl -s "$BASE_URL/api/v1/trips" -H "$AUTH_HEADER")
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "GET /trips → 返回列表" || fail "GET /trips → 失败"

# R25 钓法筛选
RESP=$(curl -s "$BASE_URL/api/v1/trips?styleCode=TRADITIONAL" -H "$AUTH_HEADER")
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "GET /trips?styleCode=TRADITIONAL → 正常返回" || fail "GET /trips?styleCode → 失败"

# R26 日期筛选
RESP=$(curl -s "$BASE_URL/api/v1/trips?startDate=2026-01-01&endDate=2026-12-31" -H "$AUTH_HEADER")
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "GET /trips?startDate&endDate → 正常返回" || fail "GET /trips 日期筛选 → 失败"

# R27 查询详情
if [ -n "$TRIP_ID" ]; then
  RESP=$(curl -s "$BASE_URL/api/v1/trips/$TRIP_ID" -H "$AUTH_HEADER")
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "GET /trips/:id → 返回详情" || fail "GET /trips/:id → 失败"
fi

# R29 更新出行
if [ -n "$TRIP_ID" ]; then
  RESP=$(curl -s -X PUT "$BASE_URL/api/v1/trips/$TRIP_ID" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"title":"已更新出行","style_ids":[1,2]}')
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "PUT /trips/:id → 更新成功" || fail "PUT /trips/:id → 失败"
fi

# R31 批量同步
LOCAL_ID="test-local-$(date +%s)"
RESP=$(curl -s -X POST "$BASE_URL/api/v1/trips/sync" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"trips":[{"trip_date":"2026-04-15","title":"离线同步测试","style_ids":[1],"local_id":"'"$LOCAL_ID"'"}]}')
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "POST /trips/sync → 同步成功" || fail "POST /trips/sync → 失败（响应：$RESP）"

# ─── 模块三：渔获记录 ─────────────────────────────────
section "模块：渔获记录"

if [ -n "$TRIP_ID" ]; then
  # R34 创建渔获
  RESP=$(curl -s -X POST "$BASE_URL/api/v1/trips/$TRIP_ID/catches" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"species":"鲫鱼","weight_g":500,"length_cm":28.5,"count":1,"is_released":false,"style_id":1}')
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  CATCH_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$SUCCESS" ] && pass "POST /trips/:id/catches → 创建成功" || fail "POST /trips/:id/catches → 失败"

  # R33 查询渔获列表
  RESP=$(curl -s "$BASE_URL/api/v1/trips/$TRIP_ID/catches" -H "$AUTH_HEADER")
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "GET /trips/:id/catches → 返回列表" || fail "GET /trips/:id/catches → 失败"
fi

if [ -n "$CATCH_ID" ]; then
  # R35 更新渔获
  RESP=$(curl -s -X PUT "$BASE_URL/api/v1/catches/$CATCH_ID" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"weight_g":600}')
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "PUT /catches/:id → 更新成功" || fail "PUT /catches/:id → 失败"

  # R36 删除渔获
  RESP=$(curl -s -X DELETE "$BASE_URL/api/v1/catches/$CATCH_ID" -H "$AUTH_HEADER")
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "DELETE /catches/:id → 删除成功" || fail "DELETE /catches/:id → 失败"
fi

# ─── 模块四：装备管理 ─────────────────────────────────
section "模块：装备管理"

# R42 分类列表
RESP=$(curl -s "$BASE_URL/api/v1/equipment/categories" -H "$AUTH_HEADER")
COUNT=$(echo "$RESP" | grep -o '"name"' | wc -l | tr -d ' ')
[ "$COUNT" -ge 9 ] && pass "GET /equipment/categories → 返回 ≥9 个预设分类" || fail "GET /equipment/categories → 预设分类数量不足（当前：$COUNT）"

# R39 创建装备
RESP=$(curl -s -X POST "$BASE_URL/api/v1/equipment" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"category_id":1,"name":"验证测试鱼竿","brand":"DAIWA","style_tags":["LURE"],"status":"active"}')
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
EQUIPMENT_ID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$SUCCESS" ] && pass "POST /equipment → 创建成功" || fail "POST /equipment → 失败"

# R37 查询装备列表
RESP=$(curl -s "$BASE_URL/api/v1/equipment" -H "$AUTH_HEADER")
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "GET /equipment → 返回列表" || fail "GET /equipment → 失败"

# R38 筛选
RESP=$(curl -s "$BASE_URL/api/v1/equipment?styleTag=LURE&status=active" -H "$AUTH_HEADER")
SUCCESS=$(echo "$RESP" | grep -o '"success":true')
[ -n "$SUCCESS" ] && pass "GET /equipment?styleTag&status → 筛选正常" || fail "GET /equipment 筛选 → 失败"

if [ -n "$EQUIPMENT_ID" ]; then
  # R40 更新装备
  RESP=$(curl -s -X PUT "$BASE_URL/api/v1/equipment/$EQUIPMENT_ID" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{"status":"retired"}')
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "PUT /equipment/:id → 更新成功" || fail "PUT /equipment/:id → 失败"

  # R41 删除装备
  RESP=$(curl -s -X DELETE "$BASE_URL/api/v1/equipment/$EQUIPMENT_ID" -H "$AUTH_HEADER")
  SUCCESS=$(echo "$RESP" | grep -o '"success":true')
  [ -n "$SUCCESS" ] && pass "DELETE /equipment/:id → 删除成功" || fail "DELETE /equipment/:id → 失败"
fi

# ─── 清理测试数据 ─────────────────────────────────────
if [ -n "$TRIP_ID" ]; then
  curl -s -X DELETE "$BASE_URL/api/v1/trips/$TRIP_ID" -H "$AUTH_HEADER" > /dev/null
fi

# ─── 结果汇总 ─────────────────────────────────────────
echo -e "\n${YELLOW}━━━ 验证结果 ━━━${NC}"
echo -e "${GREEN}通过：$PASS 项${NC}"
[ "$FAIL" -gt 0 ] && echo -e "${RED}失败：$FAIL 项${NC}" || echo -e "失败：0 项"
echo "────────────────"
TOTAL=$((PASS+FAIL))
echo "合计：$TOTAL 项"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}✓ 全部通过，可以继续下一步。${NC}"
  exit 0
else
  echo -e "\n${RED}✗ 有 $FAIL 项失败，请修复后重新运行验证。${NC}"
  exit 1
fi
