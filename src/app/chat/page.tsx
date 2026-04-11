"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    async function createAndRedirect() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title: "New Chat" })
        .select("id")
        .single();

      if (data) {
        router.replace(`/chat/${data.id}`);
      }
    }
    createAndRedirect();
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-muted-foreground animate-pulse">
        Starting new chat...
      </p>
    </div>
  );
}
