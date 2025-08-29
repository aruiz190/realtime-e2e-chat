import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import sodium from "libsodium-wrappers";
import {
  cryptoReady,
  generateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage
} from "./crypto";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5174";

export default function App() {
  const [room, setRoom] = useState("demo");
  const [name, setName] = useState("Andrew");
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState([]);
  const [input, setInput] = useState("");

  const socketRef = useRef(null);
  const myKeysRef = useRef(null);             // {publicKey, privateKey, publicKeyBase64}
  const peersRef = useRef(new Map());         // id -> { publicKey, sharedKey }
  const readyRef = useRef(false);

  useEffect(() => {
    (async () => {
      await cryptoReady;                      // wait libsodium
      myKeysRef.current = generateKeyPair();
      readyRef.current = true;

      const socket = io(SOCKET_URL, { transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("join", { room, name });
        // share our public key on join
        socket.emit("public-key", {
          room,
          publicKeyBase64: myKeysRef.current.publicKeyBase64
        });
        push(`joined room: ${room}`);
      });

      socket.on("peer-join", ({ id }) => {
        push(`peer joined: ${id}`);
        // proactively send our public key so newcomers can derive immediately
        socket.emit("public-key", {
          room,
          publicKeyBase64: myKeysRef.current.publicKeyBase64
        });
      });

      socket.on("public-key", ({ from, publicKeyBase64 }) => {
        const peerPk = sodium.from_base64(publicKeyBase64);
        const shared = deriveSharedKey(myKeysRef.current, peerPk);
        peersRef.current.set(from, { publicKey: peerPk, sharedKey: shared });
        push(`received peer key: ${from.slice(0,6)}… ✅`);
      });

      socket.on("message", ({ from, ciphertextBase64 }) => {
        const peer = peersRef.current.get(from);
        if (!peer) {
          push(`message from unknown peer ${from.slice(0,6)}…`);
          return;
        }
        const plaintext = decryptMessage(peer.sharedKey, ciphertextBase64);
        push(`${from.slice(0,6)}: ${plaintext}`);
      });

      socket.on("peer-leave", ({ id }) => {
        push(`peer left: ${id}`);
        peersRef.current.delete(id);
      });

      return () => socket.disconnect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function push(msg) {
    setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${msg}`]);
  }

  function send() {
    if (!readyRef.current || !socketRef.current) return;
    // For simplicity, encrypt to each peer separately (fan-out)
    peersRef.current.forEach(({ sharedKey }, peerId) => {
      const ciphertextBase64 = encryptMessage(sharedKey, input);
      socketRef.current.emit("message", { room, ciphertextBase64 });
      // (server broadcasts to all except sender; this will reach peers)
    });
    push(`me: ${input}`);
    setInput("");
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Realtime E2E Chat</h1>
      <div style={styles.meta}>
        <span>Room: <b>{room}</b></span>
        <span> · </span>
        <span>Status: {connected ? "🟢 connected" : "⚪ connecting…"}</span>
      </div>

      <div style={styles.chat}>
        <div style={styles.log}>
          {log.map((l, i) => <div key={i} style={styles.line}>{l}</div>)}
        </div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            value={input}
            placeholder="Type an encrypted message…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && send()}
          />
          <button style={styles.btn} onClick={send} disabled={!input.trim()}>
            Send
          </button>
        </div>
      </div>
      <p style={styles.note}>Server relays ciphertext only. Keys & decryption are entirely client-side.</p>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 780, margin: "40px auto", color: "#e9eefb", fontFamily: "Inter, system-ui, sans-serif" },
  title: { margin: 0, fontSize: 28, fontWeight: 800 },
  meta: { opacity: .8, margin: "6px 0 18px" },
  chat: { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 16 },
  log: { height: 360, overflow: "auto", padding: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: "rgba(0,0,0,.25)", borderRadius: 8 },
  line: { padding: "4px 0" },
  inputRow: { display: "flex", gap: 8, marginTop: 12 },
  input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.18)", background: "rgba(0,0,0,.25)", color: "#e9eefb" },
  btn: { padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(168,85,247,.5)", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "#fff", cursor: "pointer" },
  note: { opacity: .7, marginTop: 10 }
};
