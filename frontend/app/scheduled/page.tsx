"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import type { ScheduledMessage } from "@/lib/s3";

export default function ScheduledPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "failed">("all");

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = () => {
    fetch("/api/scheduled")
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || []);
        setLoading(false);
      });
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled message?")) return;

    const updatedMessages = messages.filter(m => m.id !== messageId);
    await fetch("/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages })
    });

    setMessages(updatedMessages);
  };

  const filteredMessages = messages.filter(m => {
    // Hide cancelled messages
    if (m.status === "cancelled") return false;

    // Treat "sending" as "pending" for filtering
    const displayStatus = m.status === "sending" ? "pending" : m.status;

    return filter === "all" || displayStatus === filter;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "sent": return "default";
      case "pending": return "secondary";
      case "sending": return "secondary"; // Treat sending like pending
      case "failed": return "destructive";
      case "cancelled": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Scheduled Messages</h1>
            <p className="text-gray-600">{messages.length} total messages</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filter === "sent" ? "default" : "outline"}
            onClick={() => setFilter("sent")}
          >
            Sent
          </Button>
          <Button
            variant={filter === "failed" ? "default" : "outline"}
            onClick={() => setFilter("failed")}
          >
            Failed
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : filteredMessages.length === 0 ? (
              <p className="text-gray-500">No messages found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map(msg => (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">{msg.contactName}</TableCell>
                      <TableCell className="max-w-xs truncate">{msg.message}</TableCell>
                      <TableCell>
                        {new Date(msg.scheduledTime).toLocaleString("en-GB", {
                          timeZone: "Europe/London",
                          dateStyle: "short",
                          timeStyle: "short"
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(msg.status)}>
                          {msg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {msg.status === "pending" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(msg.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
