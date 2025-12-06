import { useState } from "react";
import UserManagement from "../UserManagement";
import { uid } from "@/lib/utils";
import type { User } from "@shared/schema";

export default function UserManagementExample() {
  const [users, setUsers] = useState<User[]>([
    { id: uid(), name: "Mark" },
    { id: uid(), name: "Bella" },
    { id: uid(), name: "Staff" },
  ]);

  return (
    <div className="p-8 max-w-2xl">
      <UserManagement
        users={users}
        onAdd={(name) => {
          console.log("Add user:", name);
          setUsers((prev) => [...prev, { id: uid(), name }]);
        }}
        onUpdate={(id, name) => {
          console.log("Update user:", id, name);
          setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name } : u)));
        }}
        onRemove={(id) => {
          console.log("Remove user:", id);
          setUsers((prev) => prev.filter((u) => u.id !== id));
        }}
      />
    </div>
  );
}
