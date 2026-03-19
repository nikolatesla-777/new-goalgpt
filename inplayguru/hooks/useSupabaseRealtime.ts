import { useEffect, useRef } from "react";
import { supabase, TABLE } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface Options {
  channelName: string;
  event?: Event;
  table?: string;
  filter?: string;
  onData: (payload: any) => void;
}

export function useSupabaseRealtime({
  channelName,
  event = "*",
  table = TABLE,
  filter,
  onData,
}: Options) {
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    let channel: RealtimeChannel;

    const config: any = { event, schema: "public", table };
    if (filter) config.filter = filter;

    channel = supabase
      .channel(channelName)
      .on("postgres_changes", config, (payload) => onDataRef.current(payload))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, event, table, filter]);
}
