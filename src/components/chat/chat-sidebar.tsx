"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

export function ChatSidebar() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const router = useRouter();
  const params = useParams();
  const currentId = params?.id as string | undefined;

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (data) setSessions(data);
  }

  async function createSession() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: "New Chat" })
      .select("id")
      .single();

    if (data) {
      await loadSessions();
      router.push(`/chat/${data.id}`);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      <div className="p-4">
        <Button onClick={createSession} className="w-full" variant="outline">
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => router.push(`/chat/${session.id}`)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-muted",
                currentId === session.id && "bg-muted font-medium",
              )}
            >
              <span className="line-clamp-1">{session.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-4">
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
