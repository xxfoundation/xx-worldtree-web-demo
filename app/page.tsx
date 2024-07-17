"use client";
import { XXNetwork } from "./xxdk";
import IdentityCommitmentForm from "./IdentityCommitmentForm";

export default function Home() {
  return (
    <XXNetwork>
      <main className="min-h-screen p-10">
        <IdentityCommitmentForm />
      </main>
    </XXNetwork>
  );
}
