import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",fullyParallel:true,timeout:60000,
 use:{baseURL:"http://127.0.0.1:3100",trace:"retain-on-failure",channel:process.env.PLAYWRIGHT_CHANNEL==="chrome"?"chrome":undefined},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
 webServer:[
  {command:".venv/bin/python -m tests.e2e_server",cwd:"../backend",url:"http://127.0.0.1:8000/api/v1/health",reuseExistingServer:false,timeout:60000},
  {command:"npm run start -- --hostname 127.0.0.1 --port 3100",url:"http://127.0.0.1:3100",reuseExistingServer:false,timeout:60000},
 ],
});
