import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/md3";

export default function NotFoundPage() {
  const location = useLocation();
  const [imgOk, setImgOk] = useState(true);
  const imgSrc = `${process.env.PUBLIC_URL || ""}/404.png`;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center">
        {imgOk && (
          <div className="mb-6 flex items-center justify-center">
            <img
              src={imgSrc}
              alt="404"
              className="max-h-56 w-auto object-contain"
              onError={() => setImgOk(false)}
            />
          </div>
        )}
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

