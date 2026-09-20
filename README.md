# construction-tracker

建筑施工项目进度跟踪平台，用于帮助项目经理和施工团队统一管理项目进度、任务阶段、子任务、材料库存、材料领用和人员工时。

## 快速启动

```bash
docker compose up -d
```

访问地址：
- 前端：http://localhost:18701
- 后端：http://localhost:19201
- 健康检查：http://localhost:19201/api/health

## 项目主要功能

- 项目总览仪表盘：展示在建项目进度、延期预警、本月材料消耗 TOP10。
- 项目详情甘特图：按阶段和子任务展示施工时间线，预留日期调整入口。
- 任务看板：按 Todo / InProgress / Review / Done 管理子任务状态。
- 材料管理：材料库存、入库、出库、低库存预警、材料领用审批闭环和领用记录筛选。
- 人员工时统计：按人员汇总计划工时、实际工时和利用率。
- RBAC 权限控制：Admin / ProjectManager / Foreman / Worker 角色贯穿后端中间件、前端路由守卫和按钮操作。
- 操作日志：关键写操作通过后端审计服务和审计中间件记录。
- 全局异常处理：后端统一异常响应，前端请求拦截器统一提示错误。

## 本地开发方式

后端：

```bash
cd backend
npm install
npm run start:dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

本地开发默认端口：
- 前端 devServer：http://localhost:18701
- 后端本地端口：http://localhost:19201

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router v6 |
| UI | Ant Design 5、@ant-design/icons |
| 图表/时间线 | ECharts 依赖已纳入，甘特时间线以可交互布局承载 |
| 状态管理 | Zustand |
| 后端 | NestJS、TypeScript |
| ORM | TypeORM |
| 数据库 | MySQL 8.0 |
| 认证 | JWT 配置文件 + 演示鉴权中间件 |
| 部署 | Docker Compose、Nginx 反向代理 |

## 项目目录结构

```text
construction-tracker/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── api/
│       ├── stores/
│       ├── types/
│       ├── components/common/
│       ├── hooks/
│       ├── pages/
│       ├── router/
│       ├── utils/
│       └── constants/
└── backend/
    ├── Dockerfile
    └── src/
        ├── routes/
        ├── controllers/
        ├── services/
        ├── models/
        ├── middlewares/
        ├── types/
        ├── utils/
        ├── config/
        └── database/
```

## 环境变量说明

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| COMPOSE_PROJECT_NAME | Compose 项目名和容器名前缀 | construction-tracker |
| DB_NAME | MySQL 数据库名 | construction_tracker |
| DB_USER | MySQL 应用用户 | construction_user |
| DB_PASSWORD | MySQL 应用用户密码 | replace-with-a-strong-password |
| DB_ROOT_PASSWORD | MySQL root 密码 | replace-with-a-strong-root-password |
| JWT_SECRET | JWT 签名密钥 | replace-with-a-long-random-secret |
| FRONTEND_PORT | 前端宿主机端口 | 18701 |
| BACKEND_PORT | 后端宿主机端口 | 19201 |

## Docker 部署说明

`docker-compose.yml` 不使用废弃的 `version:` 字段，顶层声明 `name: construction-tracker`。服务包括：
- `db`：MySQL 8.0，使用命名卷 `mysql_data` 持久化，带健康检查。
- `backend`：NestJS 服务，容器内监听 3000，依赖数据库 healthy 后启动。
- `frontend`：Nginx 托管 Vite 构建产物，将 `/api` 反向代理到 `http://backend:3000/api/`。

常用命令：

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose down -v
```

## 枚举在前后端的所有出现位置

### ProjectStatus

- 后端定义：`backend/src/types/enums.ts`
- 后端实体：`backend/src/models/project.entity.ts`
- 后端服务：`backend/src/services/project.service.ts`
- 后端控制器：`backend/src/controllers/project.controller.ts`
- 后端种子：`backend/src/services/seed.service.ts`
- 前端定义：`frontend/src/types/enums.ts`
- 前端类型：`frontend/src/types/project.ts`
- 前端 API：`frontend/src/api/project.ts`
- 前端共享组件：`frontend/src/components/common/StatusBadge.tsx`
- 前端页面：`frontend/src/pages/Dashboard.tsx`

### TaskStatus

- 后端定义：`backend/src/types/enums.ts`
- 后端实体：`backend/src/models/subTask.entity.ts`
- 后端服务：`backend/src/services/subTask.service.ts`
- 后端控制器：`backend/src/controllers/subTask.controller.ts`
- 后端种子：`backend/src/services/seed.service.ts`
- 前端定义：`frontend/src/types/enums.ts`
- 前端类型：`frontend/src/types/task.ts`
- 前端 API：`frontend/src/api/subTask.ts`
- 前端共享组件：`frontend/src/components/common/StatusBadge.tsx`
- 前端页面：`frontend/src/pages/TaskBoard.tsx`

### Priority

- 后端定义：`backend/src/types/enums.ts`
- 后端实体：`backend/src/models/taskPhase.entity.ts`
- 后端种子：`backend/src/services/seed.service.ts`
- 前端定义：`frontend/src/types/enums.ts`
- 前端类型：`frontend/src/types/task.ts`

### MaterialUnit

- 后端定义：`backend/src/types/enums.ts`
- 后端实体：`backend/src/models/material.entity.ts`
- 后端种子：`backend/src/services/seed.service.ts`
- 前端定义：`frontend/src/types/enums.ts`
- 前端类型：`frontend/src/types/material.ts`

### RequisitionStatus（材料领用审批状态）

- 取值：Pending（待审核）/ Approved（已批准）/ Rejected（已驳回）
- 后端定义：`backend/src/types/enums.ts`
- 后端实体：`backend/src/models/materialRequisition.entity.ts`
- 后端服务：`backend/src/services/materialRequisition.service.ts`
- 后端控制器：`backend/src/controllers/materialRequisition.controller.ts`
- 后端路由：`backend/src/routes/materialRequisition.routes.ts`
- 后端种子：`backend/src/services/seed.service.ts`
- 前端定义：`frontend/src/types/enums.ts`
- 前端类型：`frontend/src/types/material.ts`
- 前端 API：`frontend/src/api/materialRequisition.ts`
- 前端状态：`frontend/src/stores/materialStore.ts`
- 前端共享组件：`frontend/src/components/common/StatusBadge.tsx`
- 前端页面：`frontend/src/pages/MaterialManage.tsx`

### 材料领用审批闭环

- 申请提交后进入待审核（Pending），数据库通过「项目-阶段-材料」存储生成列 + 唯一索引保证同一组合只能存在一份待审核申请（含并发提交）。
- 项目经理批准在单个事务内对申请行与材料行加悲观写锁：库存不足、申请已处理或并发审批落败时整次回滚，库存与领用记录均不变；成功则扣减库存、生成关联申请的领用记录并置为 Approved。
- 驳回保留申请与驳回原因（Rejected），不扣库存；被驳回申请可携带调整后的数量重新提交，生成新的待审核申请，原记录保留。
- 材料页支持按项目和阶段筛选申请与记录、审批操作，处理后统一刷新库存与列表；原有入库和直接出库能力保持可用。

## License

MIT
