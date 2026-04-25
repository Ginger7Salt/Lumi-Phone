import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// 与 GitHub 仓库名一致，默认站点为 https://<用户>.github.io/Lumi-Phone/
// 绑定自定义域名并只用域名访问时，可改为 base: '/' 后重新构建部署
export default defineConfig({
  base: '/Lumi-Phone/',
  plugins: [react(), tailwindcss(), basicSsl()],
  /** 监听 0.0.0.0，同一局域网（同一 WiFi）内设备可通过本机 IP 访问 */
  server: {
    host: true,
    port: 5173,
    // 通过 basicSsl() 启用 https；这里按 ServerOptions 传对象即可
    https: {},
  },
  preview: {
    host: true,
    port: 4173,
  },
})
