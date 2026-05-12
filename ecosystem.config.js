module.exports = {
  apps: [
    {
      name: 'focus-blues-dashboard',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
