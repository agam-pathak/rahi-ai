"use client";

import { useState } from "react";
import AddMemberModal from "./AddMemberModal";

export default function AddMemberButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-400 hover:underline"
      >
        + Add Member
      </button>

      {open && (
        <AddMemberModal
          tripId={tripId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
