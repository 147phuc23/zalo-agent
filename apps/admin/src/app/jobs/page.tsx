"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Upload, Check, Edit, RefreshCw, Plus, FileText, Globe, DollarSign, Award, CheckCircle } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface JobPosting {
  id: string;
  tenant_id: string;
  title: string;
  company_id: string;
  company: string;
  location_slugs: string[];
  work_mode: "remote" | "hybrid" | "onsite";
  salary_min_vnd: number;
  salary_max_vnd: number;
  seniority: string;
  required_skills: string[];
  description: string;
  job_type: string | null;
  experience_required_years: number | null;
  benefits: string | null;
  education_required: string | null;
  status: "draft" | "active" | "archived";
  source_document_id: string | null;
  created_at: string;
}

const CANONICAL_LOCATIONS = [
  { slug: "ho-chi-minh-city", name: "Hồ Chí Minh" },
  { slug: "ha-noi", name: "Hà Nội" },
  { slug: "da-nang", name: "Đà Nẵng" },
  { slug: "remote", name: "Từ xa / Remote" }
];

export default function JobsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draftJobs, setDraftJobs] = useState<JobPosting[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobPosting[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  
  // Form states for creating new JD
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  // UI states
  const [activeTab, setActiveTab] = useState<"drafts" | "active">("drafts");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editSalaryMin, setEditSalaryMin] = useState(0);
  const [editSalaryMax, setEditSalaryMax] = useState(0);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [editWorkMode, setEditWorkMode] = useState<"remote" | "hybrid" | "onsite">("hybrid");
  const [editSeniority, setEditSeniority] = useState("");
  const [editJobType, setEditJobType] = useState("FULL_TIME");
  const [editExpYears, setEditExpYears] = useState<number | "">("");
  const [editBenefits, setEditBenefits] = useState("");
  const [editEducation, setEditEducation] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [compRes, draftRes, activeRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/jobs?status=draft"),
        fetch("/api/jobs?status=active")
      ]);

      const compData = await compRes.json();
      const draftData = await draftRes.json();
      const activeData = await activeRes.json();

      if (compData.ok) setCompanies(compData.companies || []);
      if (draftData.ok) setDraftJobs(draftData.jobs || []);
      if (activeData.ok) setActiveJobs(activeData.jobs || []);
    } catch (err: any) {
      showToast(err.message || "Không thể tải dữ liệu", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectJobForEdit = (job: JobPosting) => {
    setSelectedJob(job);
    setEditTitle(job.title);
    setEditCompany(job.company);
    setEditSkills((job.required_skills || []).join(", "));
    setEditSalaryMin(job.salary_min_vnd);
    setEditSalaryMax(job.salary_max_vnd);
    setEditLocations(job.location_slugs || []);
    setEditWorkMode(job.work_mode);
    setEditSeniority(job.seniority);
    setEditJobType(job.job_type || "FULL_TIME");
    setEditExpYears(job.experience_required_years !== null ? job.experience_required_years : "");
    setEditBenefits(job.benefits || "");
    setEditEducation(job.education_required || "");
    setEditDescription(job.description || "");
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsLoading(true);
    try {
      const skillsArray = editSkills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const res = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patch: {
            title: editTitle,
            company: editCompany,
            requiredSkills: skillsArray,
            salaryMinVnd: editSalaryMin,
            salaryMaxVnd: editSalaryMax,
            locationSlugs: editLocations,
            workMode: editWorkMode,
            seniority: editSeniority,
            jobType: editJobType,
            experienceRequiredYears: editExpYears === "" ? null : Number(editExpYears),
            benefits: editBenefits,
            educationRequired: editEducation,
            description: editDescription
          }
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Không thể cập nhật tin tuyển dụng");

      showToast("Cập nhật thông tin thành công!");
      setSelectedJob(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateJob = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/jobs/${id}/activate`, {
        method: "POST"
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Không thể kích hoạt tin tuyển dụng");

      showToast("Kích hoạt tin tuyển dụng thành công!");
      setSelectedJob(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateJd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      showToast("Vui lòng chọn công ty", "error");
      return;
    }

    if (!pastedText && !file) {
      showToast("Vui lòng nhập nội dung JD hoặc tải lên tệp tin", "error");
      return;
    }

    setIsUploading(true);
    try {
      if (pastedText) {
        // Paste text flow
        const res = await fetch("/api/jobs/jd", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            pastedText
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Lỗi xử lý JD");

        showToast("Đã gửi văn bản JD để xử lý. Bản nháp sẽ xuất hiện sau vài giây!");
        setPastedText("");
      } else if (file) {
        // Upload file flow
        const res = await fetch("/api/jobs/jd", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            fileName: file.name,
            mimeType: file.type
          })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Không thể tạo yêu cầu tải lên");

        const { documentId, uploadUrl } = data;

        // PUT file directly to uploadUrl
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file
        });

        if (!uploadRes.ok) throw new Error("Không thể tải tệp lên kho lưu trữ");

        // Complete document upload
        const completeRes = await fetch(`/api/documents/${documentId}/complete`, {
          method: "POST"
        });
        const completeData = await completeRes.json();
        if (!completeData.ok) throw new Error(completeData.error || "Không thể hoàn thành xử lý tài liệu");

        showToast("Tải lên thành công! Bản nháp sẽ được tạo tự động.");
        setFile(null);
      }
      
      // Auto reload after a small delay to catch worker draft creation
      setTimeout(loadData, 5000);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLocationCheckbox = (slug: string) => {
    setEditLocations((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const formatVnd = (amount: number) => {
    if (amount === 0) return "Thoả thuận";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div className="flex h-screen bg-[#F0F2F5] font-sans text-slate-800 overflow-hidden">
      {/* Sidebar: Simple page selector for consistency */}
      <div className="w-full md:w-80 border-r border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold tracking-tight text-lg text-slate-800">Tuyển dụng</h2>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-gray-150 bg-stone-50 flex gap-2">
          <a href="/" className="flex-1 text-center py-1.5 text-xs font-semibold rounded-lg hover:bg-white hover:border-gray-200 text-slate-500 hover:text-slate-800 hover:shadow-xs transition">
            Hội thoại Zalo
          </a>
          <a href="/jobs" className="flex-1 text-center py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 shadow-xs text-blue-600">
            Tin tuyển dụng
          </a>
        </div>

        {/* Create JD Form */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tải lên JD mới</h3>
          
          <form onSubmit={handleCreateJd} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Công ty tuyển dụng</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                required
              >
                <option value="">-- Chọn Công ty --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tải tệp JD lên (.pdf, .docx)</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-stone-50 transition">
                  <div className="flex flex-col items-center justify-center pt-2">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{file ? file.name : "Kéo thả hoặc nhấn chọn tệp"}</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={!!pastedText}
                  />
                </label>
              </div>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold">HOẶC</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Dán văn bản JD</label>
              <textarea
                placeholder="Nhập nội dung JD chi tiết tại đây..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={5}
                className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600 placeholder-gray-400"
                disabled={!!file}
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Xử lý JD
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F4F5F7] overflow-hidden">
        {/* Main Header */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800">Danh sách tin tuyển dụng</h1>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500 transition"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("drafts")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "drafts" ? "bg-white shadow-xs text-blue-600" : "text-slate-500"
              }`}
            >
              Bản nháp ({draftJobs.length})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "active" ? "bg-white shadow-xs text-blue-600" : "text-slate-500"
              }`}
            >
              Đang tuyển ({activeJobs.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto flex gap-6">
          {/* Left half: Jobs List */}
          <div className="flex-1 space-y-3 min-w-0">
            {isLoading && (draftJobs.length === 0 && activeJobs.length === 0) ? (
              <div className="text-center py-20 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                Đang tải danh sách công việc...
              </div>
            ) : (
              <>
                {(activeTab === "drafts" ? draftJobs : activeJobs).map((job) => {
                  const isEditing = selectedJob?.id === job.id;
                  return (
                    <div
                      key={job.id}
                      className={`p-4 bg-white border rounded-2xl shadow-xs transition hover:shadow-md ${
                        isEditing ? "border-blue-500 bg-blue-50/20" : "border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-base truncate">{job.title}</h3>
                          <p className="text-sm font-semibold text-blue-600">{job.company}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                              <Globe className="w-3 h-3" />
                              {job.work_mode === "remote" ? "Remote" : job.work_mode === "hybrid" ? "Hybrid" : "Onsite"}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                              <DollarSign className="w-3 h-3" />
                              {formatVnd(job.salary_min_vnd)} - {formatVnd(job.salary_max_vnd)}
                            </span>
                            {job.seniority && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                                <Award className="w-3 h-3" />
                                {job.seniority}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1">
                            {(job.required_skills || []).map((skill, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleSelectJobForEdit(job)}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-slate-650 transition"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          {job.status === "draft" && (
                            <button
                              onClick={() => handleActivateJob(job.id)}
                              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Kích hoạt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(activeTab === "drafts" ? draftJobs : activeJobs).length === 0 && (
                  <div className="text-center py-20 text-slate-400 bg-white border border-gray-200 rounded-2xl">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Không có tin tuyển dụng nào trong trạng thái này.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right half: Editing Form (If job selected) */}
          {selectedJob && (
            <div className="w-96 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm overflow-y-auto h-fit max-h-full">
              <div className="flex justify-between items-center mb-4 border-b border-gray-150 pb-2">
                <h3 className="font-bold text-slate-800 text-md">Chỉnh sửa Bản nháp</h3>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  Đóng
                </button>
              </div>

              <form onSubmit={handleUpdateJob} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tiêu đề công việc</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Công ty</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Hình thức làm việc</label>
                  <select
                    value={editWorkMode}
                    onChange={(e) => setEditWorkMode(e.target.value as any)}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                  >
                    <option value="onsite">Onsite</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Địa điểm</label>
                  <div className="flex flex-col gap-1 bg-stone-50 border border-gray-250 rounded-xl p-2.5">
                    {CANONICAL_LOCATIONS.map((loc) => (
                      <label key={loc.slug} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editLocations.includes(loc.slug)}
                          onChange={() => handleLocationCheckbox(loc.slug)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        {loc.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Lương tối thiểu (VND)</label>
                    <input
                      type="number"
                      value={editSalaryMin}
                      onChange={(e) => setEditSalaryMin(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Lương tối đa (VND)</label>
                    <input
                      type="number"
                      value={editSalaryMax}
                      onChange={(e) => setEditSalaryMax(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 font-mono">Kỹ năng yêu cầu (cách nhau bằng dấu phẩy)</label>
                  <input
                    type="text"
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                    placeholder="Java, React, SQL..."
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cấp bậc (Seniority)</label>
                    <input
                      type="text"
                      value={editSeniority}
                      onChange={(e) => setEditSeniority(e.target.value)}
                      placeholder="junior, mid, senior..."
                      className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Loại hợp đồng</label>
                    <select
                      value={editJobType}
                      onChange={(e) => setEditJobType(e.target.value)}
                      className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    >
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERNSHIP">Internship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Số năm kinh nghiệm</label>
                  <input
                    type="number"
                    value={editExpYears}
                    onChange={(e) => setEditExpYears(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Mô tả công việc</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 font-mono">Quyền lợi (Benefits)</label>
                  <input
                    type="text"
                    value={editBenefits}
                    onChange={(e) => setEditBenefits(e.target.value)}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Yêu cầu học vấn</label>
                  <input
                    type="text"
                    value={editEducation}
                    onChange={(e) => setEditEducation(e.target.value)}
                    className="w-full bg-stone-50 border border-gray-250 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition"
                  >
                    Lưu thay đổi
                  </button>
                  {selectedJob.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => handleActivateJob(selectedJob.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Kích hoạt
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 py-3 px-5 rounded-2xl shadow-lg border text-sm font-semibold transition-all duration-300 animate-slide-in ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-250 text-emerald-850"
              : "bg-red-50 border-red-200 text-red-850"
          }`}
        >
          {toast.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <div className="w-4 h-4 text-red-600">!</div>}
          {toast.message}
        </div>
      )}
    </div>
  );
}
