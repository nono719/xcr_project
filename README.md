# 智能合约安全教学与实训平台 (XCR System)

> 本科毕业设计 · 徐成睿
> Design and Implementation of a Smart Contract Security Training Platform

集 **学习 / 练习 / 测评** 于一体的 B/S 架构智能合约安全实训平台。前后端分离，基于 Ganache 仿真链构建独立沙箱环境，内置由易到难的漏洞案例库（重入、整数溢出、抢先交易、DoS、tx.origin），自动评测并生成报告。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 + Tailwind CSS + Monaco Editor + ECharts |
| 后端 | Node.js 18 + Express + JWT + bcryptjs + Joi + winston + node-cron |
| 数据库 | MySQL 8.0 |
| 区块链仿真 | Ganache CLI + web3.js + solc 0.8.20 |
| 隔离 | 每实验独立 Ganache 进程（不同端口 / chainId） |

## 目录结构

```
xcr-system/
├─ backend/
│  ├─ src/
│  │  ├─ routes/       auth / courses / experiments / evaluation / teacher / admin / statistics
│  │  ├─ services/     sandbox / compiler / evaluator
│  │  ├─ middlewares/  auth (JWT + RBAC) / error
│  │  ├─ utils/        logger / response / jwt
│  │  └─ config/       env / db
│  ├─ contracts/       vulnerable / attack / fix 三类示例合约
│  └─ scripts/         init-db.sql / init-db.ts / seed.ts
├─ frontend/
│  └─ src/
│     ├─ pages/        Login / Register / Home / CourseList / CourseDetail /
│     │                ExperimentList / Experiment / Records / Report /
│     │                Profile / TeacherDashboard / Admin
│     ├─ components/   Layout / MonacoIDE
│     ├─ apis/         按模块封装的 axios 客户端
│     ├─ hooks/        useAuth
│     └─ routes/       PrivateRoute / RoleRoute
└─ docs/
```

## 快速开始

### 1) 准备依赖
- Node.js 18+
- MySQL 8.0+
- 全局安装 Ganache CLI：
  ```bash
  npm install -g ganache
  ```

### 2) 启动后端

```bash
cd backend
cp .env.example .env        # 修改数据库连接、JWT_SECRET
npm install
npm run db:init             # 创建数据库与表
npm run db:seed             # 初始化测试账号 + 5 个漏洞案例 + 1 门课程
npm run dev                 # http://127.0.0.1:4000
```

### 3) 启动前端

```bash
cd frontend
npm install
npm run dev                 # http://127.0.0.1:5173 ，开发代理已配置到后端
```

### 4) 默认测试账号

| 角色 | 用户名 | 密码 |
|---|---|---|
| 管理员 | admin | Admin@123 |
| 教师 | teacher01 | Teacher@123 |
| 学生 | student01 / student02 | Student@123 |

## 功能模块

| 模块 | 说明 |
|---|---|
| 用户管理 | 注册 / 登录 / JWT 鉴权 / RBAC（学生 · 教师 · 管理员） / 5 次失败锁定 15 分钟 |
| 课程学习 | 两级结构（课程 · 章节）/ 图文 · 视频 · 代码 / 学习进度 |
| 漏洞实验 | 独立 Ganache 沙箱 / Monaco 双编辑器 / 实时编译部署调用 |
| 在线评测 | 五维评分：编译 · 部署 · 执行 · 漏洞触发 · 防御有效 |
| 教学管理 | 概览统计 / 学生进度 / 案例管理 / 任务公告（node-cron 截止提醒） |
| 系统维护 | 用户启停 / 密码重置 / 操作日志（winston · 90 天） |

## 漏洞案例库

| 类型 | SWC | 难度 |
|---|---|---|
| 重入攻击 - VulnerableBank | SWC-107 | Easy |
| 整数溢出 - batchTransfer | SWC-101 | Medium |
| 抢先交易 - 密封拍卖 | SWC-114 | Medium |
| 拒绝服务 - king-of-the-hill | SWC-113 | Medium |
| tx.origin 鉴权钓鱼 | SWC-115 | Easy |

## 主要接口

| 路径 | 方法 | 描述 |
|---|---|---|
| /api/auth/login · register · me · profile | POST · GET · PUT | 登录注册与个人资料 |
| /api/courses · /:id · /modules · /progress | GET · POST · PUT · DELETE | 课程与学习进度 |
| /api/experiment/cases · /start · /stop · /compile · /deploy · /call | GET · POST | 沙箱与合约操作 |
| /api/evaluation/submit · /records/me · /report/:id | POST · GET | 评测与报告 |
| /api/teacher/overview · /students · /cases · /assignments | GET · POST · PUT · DELETE | 教师工作台 |
| /api/admin/users · /logs | GET · POST · PUT · DELETE | 系统管理 |
| /api/statistics/me | GET | 个人统计与能力雷达 |

## 后续路线（节选自论文 8.2 展望）

- Docker 化沙箱：用容器替换 Ganache 子进程，进一步隔离与并发
- 团队实验、代码互评模块
- 对接 Sepolia / Goerli 真实测试网
- 引入 Slither / Mythril 静态分析辅助

## 许可证
MIT
