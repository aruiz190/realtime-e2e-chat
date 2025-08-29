import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Simple room presence
io.on("connection", (socket) => {
  socket.on("join", ({ room, name }) => {
    socket.join(room);
    socket.data.name = name || `user-${socket.id.slice(0,5)}`;
    socket.data.room = room;
    socket.to(room).emit("peer-join", { id: socket.id, name: socket.data.name });
  });

  // Public key exchange (clients handle trust)
  socket.on("public-key", ({ room, publicKeyBase64 }) => {
    socket.to(room).emit("public-key", { from: socket.id, publicKeyBase64 });
  });

  // Encrypted messages (ciphertext only)
  socket.on("message", ({ room, ciphertextBase64 }) => {
    socket.to(room).emit("message", { from: socket.id, ciphertextBase64 });
  });

  socket.on("disconnect", () => {
    if (socket.data?.room) {
      socket.to(socket.data.room).emit("peer-leave", { id: socket.id });
    }
  });
});

const PORT = process.env.PORT || 5174;
server.listen(PORT, () => console.log(`relay server listening on :${PORT}`));
