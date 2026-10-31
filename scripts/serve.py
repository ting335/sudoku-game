from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes


mimetypes.add_type("text/javascript", ".js")


if __name__ == "__main__":
    address = ("127.0.0.1", 8000)
    print(f"Serving Sudoku at http://{address[0]}:{address[1]} (Ctrl+C to stop)")
    ThreadingHTTPServer(address, SimpleHTTPRequestHandler).serve_forever()
