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
    max_memory_restart: '500M',
    error_file: '/var/www/goalgpt/logs/pm2-error.log',
    out_file: '/var/www/goalgpt/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'production'
    },
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};


