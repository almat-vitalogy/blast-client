"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { CheckCircle, Loader, XCircle } from "lucide-react";

// Replace this with your actual Render server URL
const SERVER_URL = "https://api.turoid.ai/blast-server/";
// const SERVER_URL = "http://localhost:4000/";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [contactStatus, setContactStatus] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [contacts, setContacts] = useState<string[]>([]);
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsConnected(false);
    console.log("trying to connect to socket");
    const socket = io(SERVER_URL, {
      path: "/blast-server/socket.io",
    });

    if (!window.MediaSource) {
      console.error("MediaSource API is not supported");
      return;
    }

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }

    mediaSource.addEventListener("sourceopen", () => {
      const mimeCodec = 'video/webm; codecs="vp8"';
      const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
      sourceBufferRef.current = sourceBuffer;

      sourceBuffer.mode = "segments";

      socket.emit("start-stream", { url: "https://web.whatsapp.com/" });

      socket.on("video-stream", (chunk: ArrayBuffer) => {
        if (sourceBuffer.updating) {
          return;
        }
        setIsConnected(true);
        sourceBuffer.appendBuffer(chunk);
      });

      socket.on("stream-ended", () => {
        mediaSource.endOfStream();
      });

      socket.on("stream-error", (error) => {
        console.error("Stream error:", error);
        setIsConnected(false);
      });
    });

    return () => {
      socket.disconnect();
      if (mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }
    };
  }, []);

  const sendWhatsAppMessage = async () => {
    const phoneList = phones
      .split(",")
      .map((phone) => phone.trim())
      .filter((phone) => phone);
    console.log(phoneList);

    try {
      setStatus("loading");
      await axios.post(`${SERVER_URL}/send-message`, {
        phones: phoneList,
        message,
      });
      setStatus("success");
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      setStatus("error");
    }
  };

  const scrapeContacts = async () => {
    try {
      setContactStatus("loading");
      const res = await axios.get(`${SERVER_URL}/scrape-contacts`);
      setContacts(res.data.contacts || []);
      setContactStatus("success");
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
      setContactStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 gap-6 p-6 justify-between">
      {/* Controls Panel - Left Side */}
      <div className="flex w-1/3 flex-col justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <h1 className="text-2xl font-semibold text-gray-700 pb-3 border-b">WhatsApp Web Controller</h1>

          <div>
            <h2 className="font-medium text-gray-600 mb-2">Send Message</h2>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-3 focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="Phone numbers (comma separated)"
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              rows={2}
            />

            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-3 focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="Your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />

            <div className="flex items-center">
              <button
                className={`px-4 py-2 rounded-lg text-white transition duration-200 ${
                  status === "loading" || !phones || !message ? "bg-teal-300 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"
                }`}
                onClick={sendWhatsAppMessage}
                disabled={status === "loading" || !phones || !message}
              >
                {status === "loading" && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>

              {status === "success" && <CheckCircle className="ml-3 h-6 w-6 text-teal-600" />}
              {status === "error" && <XCircle className="ml-3 h-6 w-6 text-red-500" />}
            </div>
          </div>

          <div className="border-t pt-4">
            <h2 className="font-medium text-gray-600 mb-3">Contacts</h2>
            <button
              onClick={scrapeContacts}
              className={`px-4 py-2 rounded-lg text-white transition duration-200 ${
                contactStatus === "loading" ? "bg-sky-300 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"
              }`}
              disabled={contactStatus === "loading"}
            >
              {contactStatus === "loading" && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              {contactStatus === "loading" ? "Fetching..." : "Scrape Contacts"}
            </button>

            {contacts.length > 0 && (
              <div className="mt-3 border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50">
                <h3 className="font-medium mb-2 text-gray-600">{contacts.length} contacts found:</h3>
                <div className="text-sm text-gray-600">
                  {contacts.map((contact, idx) => (
                    <span key={idx}>
                      {contact.replace(/\+/g, "").replace(/\s+/g, "")}
                      {idx < contacts.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 bg-white rounded-xl shadow-lg p-4 text-gray-600 flex items-center justify-center">
          <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span>{isConnected ? "Connected to server" : "Disconnected"}</span>
        </div>
      </div>

      {/* Video Stream - Right Side */}
      <div className="flex justify-center items-center">
        <div className="bg-white rounded-xl shadow-lg w-[950px] h-[750px] aspect-square flex flex-col p-2">
          <h2 className="font-medium text-gray-700 mb-2">WhatsApp Web Live Stream</h2>
          <div className="flex-1 bg-gray-200 rounded overflow-hidden">
            <video ref={videoRef} controls autoPlay muted className="w-full h-full object-cover" />
          </div>
          <p className="text-xs text-gray-500 mt-2">WhatsApp Web interactions appear in real-time</p>
        </div>
      </div>
    </div>
  );
}
