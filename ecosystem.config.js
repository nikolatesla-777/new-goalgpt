module.exports = {
  apps: [
    {
      name: 'inplayguru-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/goalgpt/inplayguru',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      error_file: '/var/www/goalgpt/logs/inplayguru-error.log',
      out_file: '/var/www/goalgpt/logs/inplayguru-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
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
        NODE_ENV: 'production',
        DB_MAX_CONNECTIONS: '50'
      },
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 8000,
      kill_timeout: 15000
    }
  ]
};
