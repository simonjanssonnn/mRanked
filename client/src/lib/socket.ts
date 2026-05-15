import { io, type Socket } from "socket.io-client";

// Empty / unset -> same-origin (production). Browser handles it via window.location.
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL ?? "").trim();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const options = {
      withCredentials: true,
      autoConnect: true,
      transports: ["websocket", "polling"],
    };
    socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
