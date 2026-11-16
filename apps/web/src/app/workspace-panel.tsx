"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, MessageCircle, Send, ShieldCheck, UsersRound } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Props = { activeNav: string };
type ForumPost = { id: string; pseudonymId: string; body: string; createdAt: string };
type Psychologist = { id: string; name: string };
type ChatLine = { role: "mindbud" | "you"; text: string };

const answerChoices = ["Tidak pernah", "Kadang-kadang", "Sering", "Hampir selalu"];

export default function WorkspacePanel({ activeNav }: Props) {
  const [answers, setAnswers] = useState<number[]>(Array(21).fill(0));
  const [assessment, setAssessment] = useState("");
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [psychologistId, setPsychologistId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [postDraft, setPostDraft] = useState("");
  const [forumMessage, setForumMessage] = useState("");
  const [chat, setChat] = useState<ChatLine[]>([{ role: "mindbud", text: "Hai, aku MindBud. Apa yang terasa paling penting untuk kamu ceritakan hari ini?" }]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeNav === "Konsultasi") {
      apiRequest<{ psychologists: Psychologist[] }>("/psychologists").then((data) => {
        setPsychologists(data.psychologists);
        setError("");
      }).catch((issue) => setError(issue instanceof Error ? issue.message : "Psikolog belum dapat dimuat."));
    }
    if (activeNav === "Ruang cerita") {
      apiRequest<{ posts: ForumPost[] }>("/forum").then((data) => {
        setPosts(data.posts);
        setError("");
      }).catch((issue) => setError(issue instanceof Error ? issue.message : "Forum belum dapat dimuat."));
    }
  }, [activeNav]);

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAssessment("");
    try {
      const data = await apiRequest<{ interpretation: Record<string, { score: number; level: string }>; disclaimer: string }>("/assessments/dass21", { method: "POST", body: JSON.stringify({ answers }) });
      setAssessment(`${Object.entries(data.interpretation).map(([name, result]) => `${name}: ${result.level.toLowerCase()}`).join(" · ")}. ${data.disclaimer}`);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Asesmen belum dapat disimpan."); }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBookingMessage("");
    try {
      await apiRequest("/bookings", { method: "POST", body: JSON.stringify({ psychologistId, scheduledAt: new Date(scheduledAt).toISOString() }) });
      setBookingMessage("Permintaan jadwal berhasil dikirim. Psikolog akan mengonfirmasi sesi ini.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Jadwal belum dapat dipesan."); }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setForumMessage("");
    try {
      const data = await apiRequest<{ post: ForumPost }>("/forum", { method: "POST", body: JSON.stringify({ body: postDraft }) });
      setPosts((current) => [data.post, ...current]); setPostDraft(""); setForumMessage("Cerita dibagikan dengan pseudonym ID.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Cerita belum dapat dibagikan."); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || chatBusy) return;
    setChat((current) => [...current, { role: "you", text: message }]); setChatDraft(""); setChatBusy(true); setError("");
    try {
      const data = await apiRequest<{ reply: string }>("/mindbud", { method: "POST", body: JSON.stringify({ message }) });
      setChat((current) => [...current, { role: "mindbud", text: data.reply }]);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "MindBud belum dapat merespons."); }
    finally { setChatBusy(false); }
  }

  if (activeNav === "Asesmen diri") return <section className="feature-view">
    <div className="feature-heading"><span className="feature-icon blue"><Clock3 size={18} /></span><div><span className="eyebrow feature-eyebrow">REFLEKSI PRIBADI · ±5 MENIT</span><h2 className="display">Asesmen DASS-21</h2><p>Nilai pengalamanmu dalam 7 hari terakhir. Ini alat skrining, bukan diagnosis klinis.</p></div></div>
    <div className="notice-line"><ShieldCheck size={15} /> Isi redaksi item resmi sesuai materi berlisensi yang digunakan institusi sebelum asesmen dipakai.</div>
    <form className="assessment-form" onSubmit={submitAssessment}>
      {answers.map((answer, index) => <fieldset className="question-row" key={index}><legend><span>{String(index + 1).padStart(2, "0")}</span>Pernyataan {index + 1}</legend><div className="choice-row">{answerChoices.map((choice, value) => <label key={choice} className={answer === value ? "chosen" : ""}><input type="radio" name={`item-${index}`} checked={answer === value} onChange={() => setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} />{choice}</label>)}</div></fieldset>)}
      {error && <p className="form-error" role="alert">{error}</p>}{assessment && <p className="result-message" role="status">{assessment}</p>}
      <button className="feature-submit" type="submit">Lihat ringkasan <ArrowRight size={14} /></button>
    </form>
  </section>;

  if (activeNav === "Konsultasi") return <section className="feature-view">
    <div className="feature-heading"><span className="feature-icon"><CalendarDays size={18} /></span><div><span className="eyebrow feature-eyebrow">EMPLOYEE ASSISTANCE PROGRAM</span><h2 className="display">Jadwalkan konsultasi</h2><p>Pilih psikolog dan waktu yang paling nyaman untukmu.</p></div></div>
    <form className="feature-form" onSubmit={submitBooking}><label>Psikolog<select required value={psychologistId} onChange={(event) => setPsychologistId(event.target.value)}><option value="">Pilih psikolog</option>{psychologists.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Waktu konsultasi<input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><p className="notice-line"><ShieldCheck size={15} /> Jadwal konsultasi bersifat privat.</p>{error && <p className="form-error" role="alert">{error}</p>}{bookingMessage && <p className="result-message" role="status">{bookingMessage}</p>}<button className="feature-submit" type="submit">Ajukan jadwal <ArrowRight size={14} /></button></form>
  </section>;

  if (activeNav === "Ruang cerita") return <section className="feature-view">
    <div className="feature-heading"><span className="feature-icon warm"><UsersRound size={18} /></span><div><span className="eyebrow feature-eyebrow">KOMUNITAS KARYAWAN</span><h2 className="display">Ruang cerita anonim</h2><p>Berbagi pengalaman dengan pseudonym ID, tanpa menampilkan nama akun.</p></div></div>
    <form className="forum-composer" onSubmit={submitPost}><label htmlFor="forum-story">Apa yang ingin kamu bagikan?</label><textarea id="forum-story" maxLength={2000} required value={postDraft} onChange={(event) => setPostDraft(event.target.value)} placeholder="Tuliskan ceritamu dengan nyaman..." /><div className="composer-bottom"><span>{postDraft.length}/2000 · nama akun tidak ditampilkan</span><button className="feature-submit" type="submit">Bagikan cerita <Send size={14} /></button></div></form>
    {error && <p className="form-error" role="alert">{error}</p>}{forumMessage && <p className="result-message" role="status">{forumMessage}</p>}
    <div className="forum-list">{posts.map((post) => <article className="forum-post" key={post.id}><div className="post-avatar"><MessageCircle size={15} /></div><div><div className="post-meta"><strong>{post.pseudonymId}</strong><time>{new Date(post.createdAt).toLocaleDateString("id-ID")}</time></div><p>{post.body}</p></div></article>)}{posts.length === 0 && !error && <p className="empty-state">Belum ada cerita. Kamu bisa memulai ruang berbagi ini.</p>}</div>
  </section>;

  if (activeNav === "MindBud") return <section className="feature-view chat-view">
    <div className="feature-heading"><span className="feature-icon warm"><MessageCircle size={18} /></span><div><span className="eyebrow feature-eyebrow">DUKUNGAN AWAL</span><h2 className="display">Teman bicara MindBud</h2><p>Ruang untuk menata pikiran. Bukan pengganti psikolog atau layanan darurat.</p></div></div>
    <div className="chat-transcript" aria-live="polite">{chat.map((line, index) => <div key={index} className={`chat-line ${line.role === "you" ? "from-you" : "from-mindbud"}`}><div className="chat-bubble">{line.text}</div></div>)}{chatBusy && <div className="chat-bubble typing">MindBud sedang merespons...</div>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}<form className="chat-composer" onSubmit={sendMessage}><input aria-label="Pesan untuk MindBud" maxLength={1000} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Ceritakan apa yang ada di pikiranmu..." /><button className="feature-submit" type="submit" disabled={chatBusy}><Send size={15} /><span>Kirim</span></button></form>
    <p className="notice-line crisis-note"><ShieldCheck size={15} /> Jika kamu berada dalam bahaya langsung, hubungi layanan darurat setempat atau orang yang kamu percaya.</p>
  </section>;

  return <section className="feature-view"><div className="feature-heading"><span className="feature-icon"><ShieldCheck size={18} /></span><div><span className="eyebrow feature-eyebrow">BANTUAN</span><h2 className="display">Pusat bantuan Wellfora</h2><p>Hubungi HR atau administrator untuk kendala akun. Cerita pribadi tetap menjadi milikmu.</p></div></div><div className="notice-line"><Check size={15} /> Akses data psikologis dibatasi berdasarkan peran pengguna.</div></section>;
}
