/// <reference types="node" />
import net from "node:net";

export function startProxy(
  targetPort: number,
): Promise<{ port: number; close: () => Promise<void> }> {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
    const upstream = net.connect(targetPort, "127.0.0.1");
    sockets.add(upstream);
    upstream.on("close", () => {
      sockets.delete(upstream);
    });
    socket.pipe(upstream);
    upstream.pipe(socket);
    socket.on("error", () => {
      upstream.destroy();
    });
    upstream.on("error", () => {
      socket.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Proxy did not bind."));
        return;
      }
      let closed = false;
      resolve({
        port: address.port,
        close: () => {
          if (closed) {
            return Promise.resolve();
          }
          closed = true;
          for (const socket of sockets) {
            socket.destroy();
          }
          return new Promise((done, fail) => {
            server.close((error) => {
              if (error instanceof Error) {
                fail(error);
                return;
              }
              done();
            });
          });
        },
      });
    });
  });
}
