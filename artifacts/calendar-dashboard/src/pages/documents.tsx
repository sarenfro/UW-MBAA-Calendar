import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  Upload,
  Plus,
  Trash2,
  Settings,
  Download,
  Lock,
  Unlock,
  Shield,
  ShieldOff,
  Search,
  X,
  Check,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useListDirectoryMembers } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface DocFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdBy: string;
  restrictedEmails: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface DocFileMeta {
  id: string;
  folderId: string | null;
  lastModifiedBy: string;
  lastModifiedAt: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

// ─── session management ───────────────────────────────────────────────────────

const SESSION_KEY = "mbaa_exec_session";

function getExecSession(): { token: string; email: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveExecSession(token: string, email: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, email }));
}

function clearExecSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── api helpers ──────────────────────────────────────────────────────────────

async function apiFetch(
  url: string,
  opts: RequestInit = {},
  execToken?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (execToken) headers["x-exec-token"] = execToken;
  return fetch(url, { ...opts, headers });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function fileIconComponent(mimeType: string) {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return FileSpreadsheet;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileText;
  return File;
}

// ─── download helper ──────────────────────────────────────────────────────────

async function triggerDownload(
  fileId: string,
  fileName: string,
  execToken?: string,
  email?: string,
): Promise<void> {
  let url = `/api/documents/files/${fileId}/download`;
  if (email) url += `?email=${encodeURIComponent(email)}`;

  const headers: Record<string, string> = {};
  if (execToken) headers["x-exec-token"] = execToken;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(err.error ?? "Download failed");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="text-center py-10 border border-dashed border-border/60">
      <Icon className="h-7 w-7 mx-auto text-muted-foreground mb-2 opacity-30" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Exec Login Modal ─────────────────────────────────────────────────────────

function ExecLoginModal({
  onClose,
  onLoggedIn,
}: {
  onClose: () => void;
  onLoggedIn: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "sent">("email");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    try {
      const res = await fetch("/api/documents/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      // Dev fallback: magic link returned in response
      if (data.magicLink) {
        const url = new URL(data.magicLink);
        const token = url.searchParams.get("execToken");
        if (token) {
          const verifyRes = await fetch("/api/documents/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.ok) {
            saveExecSession(token, verifyData.email);
            onLoggedIn(token, verifyData.email);
            toast({ title: "Exec access granted", description: verifyData.email });
            onClose();
            return;
          }
        }
      }
      setPhase("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel>Executive Access</SectionLabel>
            <h2 className="font-serif text-2xl tracking-tight">
              Sign{" "}
              <em className="italic font-light text-primary">in</em>
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "email" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exec-email">UW Email</Label>
              <Input
                id="exec-email"
                type="email"
                placeholder="yournetid@uw.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={!email || isSending} className="w-full">
              {isSending ? "Sending…" : "Send Access Link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              If <span className="font-medium text-foreground">{email}</span> is authorized,
              you'll receive a link in your inbox shortly. Click it to return here with access.
            </p>
            <button
              onClick={() => setPhase("email")}
              className="text-xs text-primary hover:underline"
            >
              Try a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────

function NewFolderModal({
  parentFolderId,
  execToken,
  onClose,
  onCreated,
}: {
  parentFolderId: string | null;
  execToken: string;
  onClose: () => void;
  onCreated: (folder: DocFolder) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await apiFetch(
        "/api/documents/folders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), parentFolderId: parentFolderId ?? undefined }),
        },
        execToken,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create folder");
        return;
      }
      onCreated(data);
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <h2 className="font-serif text-2xl tracking-tight">
            New <em className="italic font-light text-primary">Folder</em>
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g. Meeting Notes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? "Creating…" : "Create Folder"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Upload File Modal ────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tiff", ".bmp", ".heic", ".avif",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
  ".md", ".markdown", ".txt", ".rtf", ".csv",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".json", ".xml", ".yaml", ".yml",
].join(",");

function UploadModal({
  folderId,
  execToken,
  onClose,
  onUploaded,
}: {
  folderId: string | null;
  execToken?: string;
  onClose: () => void;
  onUploaded: (file: DocFileMeta) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !displayName) setDisplayName(f.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !uploaderName.trim()) return;
    setError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("uploadedBy", uploaderName.trim());
      if (displayName.trim()) fd.append("name", displayName.trim());
      if (folderId) fd.append("folderId", folderId);

      const res = await apiFetch(
        "/api/documents/files/upload",
        { method: "POST", body: fd },
        execToken,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      onUploaded(data);
      onClose();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <h2 className="font-serif text-2xl tracking-tight">
            Upload <em className="italic font-light text-primary">File</em>
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border/60 hover:border-border cursor-pointer rounded-sm p-6 text-center transition-colors"
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium truncate">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to choose a file (max 50 MB)</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  PDF, Word, Excel, PowerPoint, images, Markdown, CSV, and more
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {file && (
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="File name shown to others"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="uploader-name">
              Your name or UW email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="uploader-name"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder="e.g. Jane Smith or jsmith@uw.edu"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {isUploading && (
            <p className="text-xs text-muted-foreground">Uploading… this may take a moment.</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || !uploaderName.trim() || isUploading}>
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Permissions Modal ────────────────────────────────────────────────────────

function PermissionsModal({
  folder,
  execToken,
  onClose,
  onSaved,
}: {
  folder: DocFolder;
  execToken: string;
  onClose: () => void;
  onSaved: (updated: DocFolder) => void;
}) {
  const [isRestricted, setIsRestricted] = useState(folder.restrictedEmails !== null);
  const [allowedEmails, setAllowedEmails] = useState<string[]>(
    folder.restrictedEmails ?? [],
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: members } = useListDirectoryMembers({});

  const filteredMembers = (members ?? []).filter((m) => {
    const q = memberQuery.toLowerCase();
    return (
      q.length >= 2 &&
      (m.fullName.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q))
    );
  });

  function toggleEmail(email: string) {
    setAllowedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const res = await apiFetch(
        `/api/documents/folders/${folder.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restrictedEmails: isRestricted ? allowedEmails : null,
          }),
        },
        execToken,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved(data);
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel>Folder Settings</SectionLabel>
            <h2 className="font-serif text-2xl tracking-tight truncate max-w-[280px]">
              {folder.name}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <SectionLabel>Access</SectionLabel>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setIsRestricted(false)}
              className={`flex items-center gap-3 p-3 border rounded-sm text-left transition-colors ${
                !isRestricted
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <Unlock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Open to all students</p>
                <p className="text-xs text-muted-foreground">
                  Anyone can view and download files in this folder
                </p>
              </div>
              {!isRestricted && <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
            </button>
            <button
              onClick={() => setIsRestricted(true)}
              className={`flex items-center gap-3 p-3 border rounded-sm text-left transition-colors ${
                isRestricted
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Restricted</p>
                <p className="text-xs text-muted-foreground">
                  Only specific students you choose can download
                </p>
              </div>
              {isRestricted && <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
            </button>
          </div>
        </div>

        {isRestricted && (
          <div className="space-y-3">
            <SectionLabel>Allowed Students</SectionLabel>
            {allowedEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {allowedEmails.map((em) => (
                  <span
                    key={em}
                    className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                  >
                    {em}
                    <button onClick={() => toggleEmail(em)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search students by name or email…"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {memberQuery.length >= 2 && (
              <div className="border border-border/60 divide-y divide-border/40 max-h-52 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No students found.</p>
                ) : (
                  filteredMembers.map((m) => {
                    const em = m.email ?? "";
                    const isAdded = allowedEmails.includes(em);
                    return (
                      <button
                        key={m.id}
                        onClick={() => em && toggleEmail(em)}
                        disabled={!em}
                        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">{em || "No email"}</p>
                        </div>
                        {isAdded && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {memberQuery.length > 0 && memberQuery.length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Restricted Download Modal ────────────────────────────────────────────────

function RestrictedDownloadModal({
  file,
  onClose,
}: {
  file: DocFileMeta;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsDownloading(true);
    try {
      await triggerDownload(file.id, file.name, undefined, email.trim().toLowerCase());
      toast({ title: "Download started" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border/60 w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel>Restricted File</SectionLabel>
            <h2 className="font-serif text-xl tracking-tight">{file.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          This folder has restricted access. Enter your UW email to verify you have permission.
        </p>
        <form onSubmit={handleDownload} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dl-email">Your UW Email</Label>
            <Input
              id="dl-email"
              type="email"
              placeholder="yournetid@uw.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email || isDownloading}>
              {isDownloading ? "Checking…" : "Download"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function Documents() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Exec session
  const [execSession, setExecSession] = useState<{ token: string; email: string } | null>(null);

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: null, name: "Resource Library" },
  ]);

  // Modal state
  const [showExecLogin, setShowExecLogin] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<DocFolder | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<DocFileMeta | null>(null);

  // On mount: read execToken from URL, restore session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("execToken");

    if (tokenFromUrl) {
      // Verify token, then store session
      fetch("/api/documents/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            saveExecSession(tokenFromUrl, data.email);
            setExecSession({ token: tokenFromUrl, email: data.email });
            toast({ title: "Exec access active", description: data.email });
          }
        })
        .catch(() => {})
        .finally(() => {
          navigate("/documents", { replace: true } as Parameters<typeof navigate>[1]);
        });
    } else {
      const session = getExecSession();
      if (session) setExecSession(session);
    }
  }, []);

  // Folders query
  const foldersKey = ["doc-folders", currentFolderId];
  const {
    data: folders,
    isLoading: foldersLoading,
  } = useQuery<DocFolder[]>({
    queryKey: foldersKey,
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/documents/folders?parentId=${currentFolderId}`
        : "/api/documents/folders";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load folders");
      return res.json();
    },
  });

  // Files query
  const filesKey = ["doc-files", currentFolderId];
  const {
    data: files,
    isLoading: filesLoading,
  } = useQuery<DocFileMeta[]>({
    queryKey: filesKey,
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/documents/folders/${currentFolderId}/files`
        : "/api/documents/root-files";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });

  // Delete folder mutation
  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(
        `/api/documents/folders/${id}`,
        { method: "DELETE" },
        execSession?.token,
      );
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doc-folders"] }),
    onError: () => toast({ title: "Failed to delete folder", variant: "destructive" }),
  });

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(
        `/api/documents/files/${id}`,
        { method: "DELETE" },
        execSession?.token,
      );
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doc-files"] }),
    onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
  });

  function navigateIntoFolder(folder: DocFolder) {
    setCurrentFolderId(folder.id);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    queryClient.invalidateQueries({ queryKey: ["doc-folders", folder.id] });
    queryClient.invalidateQueries({ queryKey: ["doc-files", folder.id] });
  }

  function navigateTo(item: BreadcrumbItem) {
    setCurrentFolderId(item.id);
    setBreadcrumb((prev) => {
      const idx = prev.findIndex((b) => b.id === item.id);
      return idx === -1 ? prev : prev.slice(0, idx + 1);
    });
  }

  async function handleDownloadOpen(file: DocFileMeta, folderRestricted: boolean) {
    if (!folderRestricted || execSession) {
      try {
        await triggerDownload(file.id, file.name, execSession?.token);
        toast({ title: "Download started" });
      } catch (err) {
        toast({
          title: "Download failed",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    } else {
      setDownloadTarget(file);
    }
  }

  // Determine if current folder is restricted (for context display)
  const currentFolderData = breadcrumb[breadcrumb.length - 1];
  const isFolderRestricted = useCallback(
    (fId: string | null): boolean => {
      if (!fId) return false;
      const f = folders?.find((x) => x.id === fId);
      return f?.restrictedEmails !== null && f?.restrictedEmails !== undefined;
    },
    [folders],
  );

  // Current folder's restriction for files listed here
  // We need to know if the CURRENT folder is restricted; we get that from parent folder list
  // or by looking at the breadcrumb context
  const [currentFolderMeta, setCurrentFolderMeta] = useState<DocFolder | null>(null);

  useEffect(() => {
    if (!currentFolderId) {
      setCurrentFolderMeta(null);
      return;
    }
    fetch(`/api/documents/folders/${currentFolderId}`)
      .then((r) => r.json())
      .then((data) => setCurrentFolderMeta(data))
      .catch(() => {});
  }, [currentFolderId]);

  const filesAreRestricted =
    currentFolderMeta?.restrictedEmails !== null &&
    currentFolderMeta?.restrictedEmails !== undefined;

  const isLoading = foldersLoading || filesLoading;

  return (
    <Layout>
      {/* Back link */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Calendar
        </Link>
      </div>

      {/* Header */}
      <section className="mb-8 max-w-3xl">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary mb-4">
          Document Library
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-foreground">
            MBAA{" "}
            <em className="italic font-light text-primary">Resources</em>
          </h1>
          {execSession ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                <Shield className="h-3 w-3" />
                {execSession.email}
              </div>
              <button
                onClick={() => {
                  clearExecSession();
                  setExecSession(null);
                  toast({ title: "Signed out" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowExecLogin(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Executive Login
            </button>
          )}
        </div>
      </section>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-6 flex-wrap">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
            {i < breadcrumb.length - 1 ? (
              <button
                onClick={() => navigateTo(item)}
                className="hover:text-primary transition-colors"
              >
                {item.name}
              </button>
            ) : (
              <span className="font-medium text-foreground">{item.name}</span>
            )}
          </span>
        ))}
        {filesAreRestricted && (
          <span className="ml-2 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Lock className="h-2.5 w-2.5" />
            Restricted
          </span>
        )}
      </nav>

      {/* Action bar — Upload open to all; folder management exec-only */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          size="sm"
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </Button>
        {execSession && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Folder
          </Button>
        )}
      </div>

      {/* Folders */}
      <div className="space-y-2 mb-8">
        {foldersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-background p-4 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : !folders || folders.length === 0 ? null : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 border border-border/60">
            {folders.map((folder) => (
              <div key={folder.id} className="group bg-background hover:bg-card transition-colors relative">
                <button
                  onClick={() => navigateIntoFolder(folder)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  {folder.restrictedEmails !== null ? (
                    <FolderOpen className="h-6 w-6 text-amber-600 flex-shrink-0" />
                  ) : (
                    <Folder className="h-6 w-6 text-primary flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{folder.name}</p>
                    {folder.restrictedEmails !== null && (
                      <p className="text-[10px] text-amber-700 flex items-center gap-1 mt-0.5">
                        <Lock className="h-2.5 w-2.5" />
                        Restricted
                      </p>
                    )}
                  </div>
                </button>
                {execSession && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPermissionsTarget(folder)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      title="Folder settings"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${folder.name}" and all its contents?`)) {
                          deleteFolder.mutate(folder.id);
                        }
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete folder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files */}
      <div>
        {filesLoading ? (
          <div className="space-y-px border border-border/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-background p-4 flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1 max-w-xs" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : !files || files.length === 0 ? (
          folders && folders.length === 0 ? (
            <EmptyState icon={FolderOpen} label="This folder is empty." />
          ) : null
        ) : (
          <div className="border border-border/60 divide-y divide-border/40">
            {files.map((file) => {
              const Icon = fileIconComponent(file.mimeType);
              return (
                <div
                  key={file.id}
                  className="group bg-background hover:bg-card transition-colors p-4 flex items-center gap-3"
                >
                  <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)} · {fmtDate(file.createdAt)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Last modified {fmtDate(file.lastModifiedAt)} by {file.lastModifiedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDownloadOpen(file, filesAreRestricted)}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    {execSession && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${file.name}"?`)) {
                            deleteFile.mutate(file.id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty root state */}
      {!isLoading &&
        (!folders || folders.length === 0) &&
        (!files || files.length === 0) && (
          <EmptyState
            icon={FolderOpen}
            label={
              execSession
                ? "No files yet. Upload a file or create a folder to get started."
                : "No files have been uploaded yet."
            }
          />
        )}

      {/* Modals */}
      {showExecLogin && (
        <ExecLoginModal
          onClose={() => setShowExecLogin(false)}
          onLoggedIn={(token, email) => {
            saveExecSession(token, email);
            setExecSession({ token, email });
          }}
        />
      )}
      {showNewFolder && execSession && (
        <NewFolderModal
          parentFolderId={currentFolderId}
          execToken={execSession.token}
          onClose={() => setShowNewFolder(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["doc-folders"] })}
        />
      )}
      {showUpload && (
        <UploadModal
          folderId={currentFolderId}
          execToken={execSession?.token}
          onClose={() => setShowUpload(false)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: ["doc-files"] })}
        />
      )}
      {permissionsTarget && execSession && (
        <PermissionsModal
          folder={permissionsTarget}
          execToken={execSession.token}
          onClose={() => setPermissionsTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["doc-folders"] });
            setPermissionsTarget(null);
          }}
        />
      )}
      {downloadTarget && (
        <RestrictedDownloadModal
          file={downloadTarget}
          onClose={() => setDownloadTarget(null)}
        />
      )}
    </Layout>
  );
}
