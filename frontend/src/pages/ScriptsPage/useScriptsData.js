import { useState, useEffect, useCallback } from 'react';
import { api } from '@/config/api';
import { toast } from 'sonner';

const INITIAL_FORM_DATA = {
  system_id: "",
  name: "",
  description: "",
  content: "",
  processor_script: "",
  processor_script_comment: "",
  create_new_version: false,
  has_reference_files: false,
  test_methodology: "",
  success_criteria: "",
  order: 0,
  group_ids: []
};

export const useScriptsData = () => {
  const [scripts, setScripts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [systems, setSystems] = useState([]);
  const [checkGroups, setCheckGroups] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  
  // Form state
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSystems, setFormSystems] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [editingScript, setEditingScript] = useState(null);

  // Fetch functions
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки категорий");
    }
  }, []);

  const fetchSystemsByCategory = useCallback(async (categoryId) => {
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  }, []);

  const fetchScripts = useCallback(async () => {
    try {
      let url = '/api/scripts';
      if (selectedSystem && selectedSystem !== "all") {
        url += `?system_id=${selectedSystem}`;
      } else if (selectedCategory && selectedCategory !== "all") {
        url += `?category_id=${selectedCategory}`;
      }
      const response = await api.get(url);
      setScripts(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки проверок");
    }
  }, [selectedSystem, selectedCategory]);

  const fetchCheckGroups = useCallback(async () => {
    try {
      const response = await api.get('/api/check-groups');
      setCheckGroups(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки групп проверок");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchCategories(),
      fetchCheckGroups()
    ]);

    if (selectedCategory && selectedCategory !== "all") {
      await fetchSystemsByCategory(selectedCategory);
    }

    await fetchScripts();
  }, [fetchCategories, fetchCheckGroups, fetchSystemsByCategory, fetchScripts, selectedCategory]);

  // Initial load
  useEffect(() => {
    fetchCategories();
    fetchScripts();
    fetchCheckGroups();
  }, []);

  // Category change effect
  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      fetchSystemsByCategory(selectedCategory);
    } else {
      setSystems([]);
      setSelectedSystem("all");
    }
  }, [selectedCategory, fetchSystemsByCategory]);

  // System change effect
  useEffect(() => {
    fetchScripts();
  }, [selectedSystem, fetchScripts]);

  // Form helpers
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setFormCategoryId("");
    setFormSystems([]);
    setEditingScript(null);
  }, []);

  const handleCategoryChangeInForm = useCallback(async (categoryId) => {
    setFormCategoryId(categoryId);
    setFormData(prev => ({ ...prev, system_id: "" }));
    
    try {
      const response = await api.get(`/api/systems?category_id=${categoryId}`);
      setFormSystems(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки систем");
    }
  }, []);

  const openEditDialog = useCallback(async (script) => {
    try {
      const fullScript = await api.get(`/api/scripts/${script.id}`);
      const scriptData = fullScript.data;
      
      setEditingScript(scriptData);
      const currentVersionComment = scriptData.processor_script_version?.comment || "";
      
      setFormData({
        system_id: scriptData.system_id,
        name: scriptData.name,
        description: scriptData.description || "",
        content: scriptData.content,
        processor_script: scriptData.processor_script || "",
        processor_script_comment: currentVersionComment,
        create_new_version: true,
        has_reference_files: scriptData.has_reference_files || false,
        test_methodology: scriptData.test_methodology || "",
        success_criteria: scriptData.success_criteria || "",
        order: scriptData.order || 0,
        group_ids: scriptData.group_ids || []
      });
      
      // Load system info
      try {
        const systemRes = await api.get(`/api/systems/${scriptData.system_id}`);
        const system = systemRes.data;
        setFormCategoryId(system.category_id);
        
        const systemsRes = await api.get(`/api/systems?category_id=${system.category_id}`);
        setFormSystems(systemsRes.data);
      } catch (error) {
        console.error("Error loading system info:", error);
      }
      
      return true;
    } catch (error) {
      console.error("Error loading script:", error);
      toast.error("Ошибка загрузки проверки");
      return false;
    }
  }, []);

  return {
    // Data
    scripts,
    categories,
    systems,
    checkGroups,
    selectedCategory,
    selectedSystem,
    
    // Setters
    setSelectedCategory,
    setSelectedSystem,
    setCheckGroups,
    
    // Form state
    formData,
    setFormData,
    formCategoryId,
    setFormCategoryId,
    formSystems,
    editingScript,
    setEditingScript,
    
    // Actions
    fetchScripts,
    fetchCheckGroups,
    fetchCategories,
    refreshAll,
    resetForm,
    handleCategoryChangeInForm,
    openEditDialog,
    
    // Constants
    INITIAL_FORM_DATA
  };
};

export default useScriptsData;

