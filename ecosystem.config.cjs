module.exports = {
  apps: [{
    name: "salespt-log",
    // ⚠️ npm 경유 금지 — pm2 가 npm → sh → next-server 손자 프로세스의 stdout 을
    // 수집하지 못해 앱 로그가 전량 유실된다(2026-09-14 실측: api_timing 0건).
    // next 바이너리를 pm2 직속 자식으로 띄워야 console.log 가 로그파일에 남는다.
    script: "node_modules/.bin/next",
    args: "start -p 3000",
    cwd: "/opt/salespt-log",
    exec_mode: "cluster",
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G",
    time: true,
    env: { NODE_ENV: "production", PORT: "3000" }
  }],
};
