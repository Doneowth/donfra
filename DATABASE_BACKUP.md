# Database Backup & Restore Guide

这个文档说明如何备份和恢复 Donfra PostgreSQL 数据库。

## 快速开始

### 1. 备份数据库

```bash
make db-backup
```

这会在 `./db-backups/` 目录下创建一个带时间戳的备份文件，例如：
```
./db-backups/donfra_backup_20231227_143022.sql
```

### 2. 查看所有备份

```bash
make db-list-backups
```

### 3. 恢复数据库

```bash
make db-restore BACKUP_FILE=./db-backups/donfra_backup_20231227_143022.sql
```

⚠️ **警告**: 恢复操作会覆盖当前数据库的所有数据！

## 完整工作流程示例

### 场景：更新软件前备份，更新后恢复

#### 步骤 1: 更新前备份数据库

```bash
# 1. 备份当前数据库
make db-backup

# 输出示例：
# 📦 Starting database backup...
# Backup file: ./db-backups/donfra_backup_20231227_143022.sql
# ✅ Backup completed successfully!
# File size: 24K
```

#### 步骤 2: 停止服务并更新

```bash
# 2. 停止所有服务
make prod-down

# 3. 更新代码、配置等
git pull
# 或者修改 docker-compose.yml 中的镜像版本等

# 4. 重新启动服务
make prod-up
```

#### 步骤 3: 恢复数据库（如果需要）

```bash
# 5. 查看可用的备份
make db-list-backups

# 6. 恢复到之前的备份
make db-restore BACKUP_FILE=./db-backups/donfra_backup_20231227_143022.sql

# 系统会提示确认：
# ⚠️  This will OVERWRITE the current database. Continue? (yes/no):
# 输入 yes 确认

# 输出示例：
# Dropping existing database...
# Restoring from backup...
# ✅ Restore completed successfully!
```

## 手动操作方法

如果你不想使用 Makefile，也可以直接运行脚本：

### 备份

```bash
./backup-db.sh
```

### 恢复

```bash
./restore-db.sh ./db-backups/donfra_backup_20231227_143022.sql
```

## 备份文件说明

### 文件命名格式

```
donfra_backup_YYYYMMDD_HHMMSS.sql
```

例如：
- `donfra_backup_20231227_143022.sql` = 2023年12月27日 14:30:22 的备份

### 备份内容

备份文件包含：
- 所有表结构（CREATE TABLE 语句）
- 所有数据（INSERT 语句）
- 索引、约束等数据库对象

### 备份文件位置

所有备份存储在：`./db-backups/`

## 注意事项

### ⚠️ 重要警告

1. **恢复操作会删除现有数据**：恢复前请确认你要覆盖当前数据库
2. **需要容器运行**：备份和恢复都需要 `donfra-db` 容器在运行状态
3. **定期备份**：建议在重要操作前都进行备份

### 最佳实践

1. **重要操作前备份**：
   - 更新软件版本前
   - 修改数据库结构前
   - 执行批量数据操作前

2. **保留多个备份**：
   - 不要只保留最新的一个备份
   - 建议至少保留最近3-5个备份

3. **测试恢复流程**：
   - 定期测试备份文件能否正常恢复
   - 确保备份文件没有损坏

4. **备份到其他位置**：
   - 将重要备份复制到其他服务器或云存储
   - 防止本地磁盘故障导致备份丢失

## 故障排除

### 问题：容器未运行

```bash
# 错误信息
Error: No such container: donfra-db

# 解决方法：启动数据库容器
make prod-up
# 或
make localdev-up
```

### 问题：备份文件过大

```bash
# 如果备份文件很大，可以压缩
gzip ./db-backups/donfra_backup_20231227_143022.sql

# 恢复时先解压
gunzip ./db-backups/donfra_backup_20231227_143022.sql.gz
make db-restore BACKUP_FILE=./db-backups/donfra_backup_20231227_143022.sql
```

### 问题：权限错误

```bash
# 如果脚本没有执行权限
chmod +x backup-db.sh restore-db.sh
```

## 高级用法

### 仅备份特定表

```bash
# 手动运行 pg_dump，指定表名
docker exec -i donfra-db pg_dump -U donfra -d donfra_study -t lessons > lessons_only.sql
```

### 备份到远程服务器

```bash
# 备份并通过SSH传输到远程服务器
make db-backup
scp ./db-backups/donfra_backup_*.sql user@remote-server:/backups/
```

### 定时自动备份（使用 cron）

```bash
# 添加到 crontab（每天凌晨2点备份）
0 2 * * * cd /path/to/donfra && make db-backup >> /var/log/donfra-backup.log 2>&1
```

## 相关命令

| 命令 | 说明 |
|------|------|
| `make db-backup` | 创建数据库备份 |
| `make db-restore BACKUP_FILE=<path>` | 恢复数据库 |
| `make db-list-backups` | 列出所有备份文件 |
| `make prod-down` | 停止生产环境 |
| `make prod-up` | 启动生产环境 |
| `make localdev-down` | 停止本地开发环境 |
| `make localdev-up` | 启动本地开发环境 |
