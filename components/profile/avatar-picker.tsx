"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { removeAvatar, uploadAvatar } from "@/app/actions/user";
import { avatarLimits } from "@/lib/config";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Resize in the browser, upload the result.
 *
 * The whole reason the picture is shrunk here rather than on the server is that
 * this app has no image library and wants none — no `sharp`, no upload
 * middleware, nothing to install. A canvas does the one transformation that
 * matters, and what crosses the wire is already about 30 KB rather than the
 * 4 MB that came out of a phone camera.
 *
 * None of it is a control. The server re-reads the type out of the bytes and
 * re-checks the size (`lib/avatar.ts`), because a Server Action takes whatever
 * it is sent regardless of what this component would have produced.
 */

/** Centre-crop to a square and scale to the configured edge. */
async function toSquareDataUri(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const edge = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - edge) / 2;
    const sy = (bitmap.height - edge) / 2;

    const size = avatarLimits.dimension;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", avatarLimits.quality);
  } finally {
    bitmap.close();
  }
}

export function AvatarPicker({
  src,
  initials,
}: {
  src: string | null;
  initials: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  /** Shown immediately, so the new photo appears before the round trip ends. */
  const [preview, setPreview] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input straight away, so picking the same file twice after a
    // failure still fires a change event.
    e.target.value = "";
    if (!file) return;

    let dataUri: string;
    try {
      dataUri = await toSquareDataUri(file);
    } catch {
      toast.error("That image couldn't be read. Try a JPEG or PNG.");
      return;
    }

    setPreview(dataUri);
    startTransition(async () => {
      const result = await uploadAvatar(dataUri);
      if (!result.ok) {
        setPreview(null);
        toast.error(result.error ?? "Upload failed.");
        return;
      }
      toast.success("Photo updated");
      router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't remove the photo.");
        return;
      }
      setPreview(null);
      toast.success("Photo removed");
      router.refresh();
    });
  }

  const shown = preview ?? src;

  return (
    <div className="flex items-center gap-4">
      <Avatar src={shown} initials={initials} size="lg" alt="Your profile photo" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {shown ? "Change photo" : "Upload photo"}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG or WebP. It&apos;s cropped square and shrunk to{" "}
          {avatarLimits.dimension}px before it leaves your browser.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
        />
      </div>
    </div>
  );
}
