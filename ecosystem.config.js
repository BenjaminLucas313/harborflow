module.exports = {
  apps: [
    {
      name: 'harborflow',
      script: 'npm',
      args: 'start',
      cwd: '/home/harborflow/app',

      // Cluster mode: aprovecha múltiples CPUs
      instances: 2,
      exec_mode: 'cluster',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logs
      error_file: '/var/log/harborflow/error.log',
      out_file: '/var/log/harborflow/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Reinicio automático si la memoria supera 1 GB
      max_memory_restart: '1G',

      // Comportamiento
      autorestart: true,
      watch: false,

      // Tiempo de espera para considerar el proceso como iniciado
      wait_ready: true,
      listen_timeout: 10000,

      // Reintentos antes de marcar como fallido
      max_restarts: 10,
      min_uptime: '5s',
    },
  ],
}
