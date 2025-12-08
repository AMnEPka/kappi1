// hooks/useDialog.js
import { useState } from 'react';

export const useDialog = () => {
  const [dialogState, setDialogState] = useState({
    open: false,
    title: "",
    description: "",
    onConfirm: null,
    onCancel: null,
    variant: "default",
    confirmText: "ОК",
    cancelText: "Отмена",
  });

  const showAlert = (title, description, options = {}) => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title,
        description,
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, open: false }));
          resolve(true);
        },
        onCancel: null,
        variant: options.variant || "default",
        confirmText: options.confirmText || "ОК",
        cancelText: options.cancelText || "Отмена",
      });
    });
  };

  const showConfirm = (title, description, options = {}) => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title,
        description,
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, open: false }));
          resolve(true);
        },
        onCancel: () => {
          setDialogState(prev => ({ ...prev, open: false }));
          resolve(false);
        },
        variant: options.variant || "default",
        confirmText: options.confirmText || "Да",
        cancelText: options.cancelText || "Отмена",
      });
    });
  };

  const closeDialog = () => {
    setDialogState(prev => ({ ...prev, open: false }));
  };

  return {
    dialogState,
    setDialogState,
    showAlert,
    showConfirm,
    closeDialog,
  };
};