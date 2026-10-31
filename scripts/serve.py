from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
import argparse


mimetypes.add_type("text/javascript", ".js")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve the local game without dependencies")
    parser.add_argument("port", nargs="?", type=int, default=8000)
    args = parser.parse_args()
    address = ("127.0.0.1", args.port)
    print(f"Serving Sudoku at http://{address[0]}:{address[1]} (Ctrl+C to stop)")
    ThreadingHTTPServer(address, SimpleHTTPRequestHandler).serve_forever()
