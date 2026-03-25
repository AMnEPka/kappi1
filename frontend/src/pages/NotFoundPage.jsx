import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/md3";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center">
        <div className="mb-6 flex items-center justify-center">
          <img
            src="/404.png"
            alt="404"
            className="   w-auto object-contain"
          />
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="tonal">На главную</Button>
          </Link>
          <Button variant="text" onClick={() => window.history.back()}>
            Назад
          </Button>
        </div>
      </div>
    </div>
  );
}

