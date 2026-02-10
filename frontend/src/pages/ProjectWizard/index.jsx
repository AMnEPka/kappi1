import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { WizardProvider, useWizard } from './WizardContext';

// Step components
import Step1BasicInfo from './Step1BasicInfo';
import Step2HostSelection from './Step2HostSelection';
import Step3TaskAssignment from './Step3TaskAssignment';
import Step4ReferenceData from './Step4ReferenceData';
import Step5AccessManagement from './Step5AccessManagement';
import Step6Confirmation from './Step6Confirmation';

// Progress bar component
const WizardProgress = () => {
  const { step } = useWizard();
  
  return (
    <div className="w-full flex items-center mt-4 px-4">
      {[1, 2, 3, 4, 5, 6].map((s, index) => (
        <React.Fragment key={s}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              s <= step ? 'bg-yellow-400 text-white' : 'bg-gray-300 text-gray-600'
            }`}
          >
            {s < step ? <Check className="h-4 w-4" /> : s}
          </div>
          {index < 5 && (
            <div
              className={`flex-1 h-1 ${
                s < step ? 'bg-yellow-400' : 'bg-gray-300'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Navigation buttons component
const WizardNavigation = () => {
  const { step, handleNext, handleBack, handleCreateProject, loading, onNavigate } = useWizard();
  
  return (
    <div className="flex justify-between mb-3">
      <Button
        variant="outline"
        onClick={step === 1 ? () => onNavigate('projects') : handleBack}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        {step === 1 ? 'Отмена' : 'Назад'}
      </Button>

      {step < 6 ? (
        <Button onClick={handleNext}>
          Далее
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={handleCreateProject} disabled={loading}>
          {loading ? 'Создание...' : 'Создать проект'}
        </Button>
      )}
    </div>
  );
};

// Step renderer component
const WizardStep = () => {
  const { step, hasReferenceFiles } = useWizard();
  
  switch (step) {
    case 1:
      return <Step1BasicInfo />;
    case 2:
      return <Step2HostSelection />;
    case 3:
      return <Step3TaskAssignment />;
    case 4:
      return hasReferenceFiles ? <Step4ReferenceData /> : null;
    case 5:
      return <Step5AccessManagement />;
    case 6:
      return <Step6Confirmation />;
    default:
      return null;
  }
};

// Main wizard content (uses context)
const WizardContent = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Создание проекта</h1>
        <WizardProgress />
      </div>

      <WizardNavigation />
      <WizardStep />
    </div>
  );
};

// Main exported component with provider
export default function ProjectWizard({ onNavigate, initialPreset }) {
  return (
    <WizardProvider onNavigate={onNavigate} initialPreset={initialPreset}>
      <WizardContent />
    </WizardProvider>
  );
}

