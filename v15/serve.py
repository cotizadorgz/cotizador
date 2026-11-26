# Servidor local de desarrollo. Hace falta porque los módulos ES no cargan por file://
# y en esta máquina no hay Node. Uso: python3 serve.py  → http://localhost:8765
import http.server, socketserver, os

class Handler(http.server.SimpleHTTPRequestHandler):
    # Sin esto el navegador cachea los módulos y seguís viendo código viejo.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8765), Handler) as s:
    print("sirviendo en http://localhost:8765")
    s.serve_forever()
