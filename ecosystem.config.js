module.exports = {
  apps: [{
    name: 'goalgpt-backend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/goalgpt',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    node_args: '--max-old-space-size=2048',  // 2GB heap to prevent OOM
    max_memory_restart: '1800M',  // Restart if memory exceeds 1.8GB
    error_file: '/var/www/goalgpt/logs/pm2-error.log',
    out_file: '/var/www/goalgpt/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'production'
    },
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 8000,  // Increased from 4s to 8s for proper port cleanup
    kill_timeout: 15000  // Allow 15s for graceful shutdown before SIGKILL
  }]
};


