// components/ConfirmationDialog.jsx
import DOMPurify from 'dompurify';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  
  export const ConfirmationDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmText = "ОК",
    cancelText = "Отмена",
    onConfirm,
    onCancel,
    variant = "default", // "default" | "destructive"
  }) => {
    // Санитизация HTML для предотвращения XSS
    const sanitizedDescription = description 
      ? DOMPurify.sanitize(description, { 
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
          ALLOWED_ATTR: ['class']
        })
      : null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {sanitizedDescription && (
              <DialogDescription 
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
            )}
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 pt-4">
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
              >
                {cancelText}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
