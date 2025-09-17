"use client";
import { useEffect, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import Link from "next/link";

type Teacher = {
  id: string;
  full_name: string;
  slug: string;
  email: string | null;
};
type Join = { teacher_id: string; category_slug: string };
type Cert = {
  id: string;
  teacher_id: string;
  category_slug: string;
  file_path: string;
  created_at: string;
};

export default function AdminDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [joins, setJoins] = useState<Join[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCats, setEditCats] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [selectAllCerts, setSelectAllCerts] = useState(false);
  const [showCertsSection, setShowCertsSection] = useState(false);
  const [certSearchTerm, setCertSearchTerm] = useState("");
  const [certSortBy, setCertSortBy] = useState<"name" | "teacher" | "category" | "date">("date");
  const [certSortOrder, setCertSortOrder] = useState<"asc" | "desc">("desc");

  async function loadData() {
    setLoading(true);
    try {
      const [teachersRes, joinsRes, certsRes] = await Promise.all([
        supabase
          .from("teachers")
          .select("id, full_name, slug, email")
          .order("full_name"),
        supabase.from("teacher_categories").select("teacher_id, category_slug"),
        supabase
          .from("certificates")
          .select("id, teacher_id, category_slug, file_path, created_at"),
      ]);

      setTeachers(teachersRes.data || []);
      setJoins(joinsRes.data || []);
      setCerts(certsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      setMsg("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // สร้าง map ของหมวดหมู่ต่อครู
  const catsByTeacher = joins.reduce((acc, join) => {
    if (!acc[join.teacher_id]) acc[join.teacher_id] = [];
    acc[join.teacher_id].push(join.category_slug);
    return acc;
  }, {} as Record<string, string[]>);

  // สร้าง map ของจำนวนใบรับรองต่อครู
  const certsByTeacher = certs.reduce((acc, cert) => {
    acc[cert.teacher_id] = (acc[cert.teacher_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  async function deleteTeacher(id: string, name: string) {
    if (
      !confirm(
        `ต้องการลบครู "${name}" ใช่หรือไม่?\n\nการลบนี้จะลบข้อมูลครูและการเชื่อมโยงหมวดหมู่ทั้งหมด แต่ไฟล์ใบรับรองจะยังคงอยู่`
      )
    ) {
      return;
    }

    try {
      // ลบการเชื่อมโยงหมวดหมู่ก่อน
      await supabase.from("teacher_categories").delete().eq("teacher_id", id);

      // ลบครู
      const { error } = await supabase.from("teachers").delete().eq("id", id);

      if (error) throw error;

      setMsg(`✅ ลบครู "${name}" สำเร็จ`);
      loadData();
    } catch (error: unknown) {
      setMsg(
        `❌ ลบไม่สำเร็จ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  function startEdit(teacher: Teacher) {
    setEditingTeacher(teacher);
    setEditName(teacher.full_name);
    setEditEmail(teacher.email || "");
    setEditCats(catsByTeacher[teacher.id] || []);
  }

  async function saveEdit() {
    if (!editingTeacher) return;

    try {
      // อัปเดตข้อมูลครู
      const { error: teacherError } = await supabase
        .from("teachers")
        .update({
          full_name: editName.trim(),
          email: editEmail.trim() || null,
        })
        .eq("id", editingTeacher.id);

      if (teacherError) throw teacherError;

      // อัปเดตหมวดหมู่
      // ลบการเชื่อมโยงเดิม
      await supabase
        .from("teacher_categories")
        .delete()
        .eq("teacher_id", editingTeacher.id);

      // เพิ่มการเชื่อมโยงใหม่
      if (editCats.length > 0) {
        const newJoins = editCats.map((cat) => ({
          teacher_id: editingTeacher.id,
          category_slug: cat,
        }));
        const { error: joinError } = await supabase
          .from("teacher_categories")
          .insert(newJoins);
        if (joinError) throw joinError;
      }

      setMsg(`✅ แก้ไขครู "${editName}" สำเร็จ`);
      setEditingTeacher(null);
      loadData();
    } catch (error: unknown) {
      setMsg(
        `❌ แก้ไขไม่สำเร็จ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  function cancelEdit() {
    setEditingTeacher(null);
    setEditName("");
    setEditEmail("");
    setEditCats([]);
  }

  function toggleEditCat(slug: string) {
    setEditCats((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  // Filter teachers based on search term
  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle individual teacher selection
  function toggleTeacherSelection(teacherId: string) {
    setSelectedTeachers((prev) =>
      prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId]
    );
  }

  // Handle select all
  function toggleSelectAll() {
    if (selectAll) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(filteredTeachers.map((teacher) => teacher.id));
    }
    setSelectAll(!selectAll);
  }

  // Filter and sort certificates
  const filteredAndSortedCerts = certs
    .filter((cert) => {
      if (!certSearchTerm) return true;
      
      const teacher = teachers.find((t) => t.id === cert.teacher_id);
      const category = CATEGORIES.find((c) => c.slug === cert.category_slug);
      const fileName = cert.file_path.split("/").pop() || "";
      
      return (
        fileName.toLowerCase().includes(certSearchTerm.toLowerCase()) ||
        teacher?.full_name.toLowerCase().includes(certSearchTerm.toLowerCase()) ||
        category?.label.toLowerCase().includes(certSearchTerm.toLowerCase()) ||
        cert.category_slug.toLowerCase().includes(certSearchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (certSortBy) {
        case "name":
          aValue = (a.file_path.split("/").pop() || "").toLowerCase();
          bValue = (b.file_path.split("/").pop() || "").toLowerCase();
          break;
        case "teacher":
          const aTeacher = teachers.find((t) => t.id === a.teacher_id);
          const bTeacher = teachers.find((t) => t.id === b.teacher_id);
          aValue = (aTeacher?.full_name || "").toLowerCase();
          bValue = (bTeacher?.full_name || "").toLowerCase();
          break;
        case "category":
          const aCategory = CATEGORIES.find((c) => c.slug === a.category_slug);
          const bCategory = CATEGORIES.find((c) => c.slug === b.category_slug);
          aValue = (aCategory?.label || a.category_slug).toLowerCase();
          bValue = (bCategory?.label || b.category_slug).toLowerCase();
          break;
        case "date":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return certSortOrder === "asc" 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      if (certSortOrder === "asc") {
        return (aValue as number) - (bValue as number);
      } else {
        return (bValue as number) - (aValue as number);
      }
    });

  // Update select all certs when filtered certs change
  useEffect(() => {
    if (filteredAndSortedCerts.length > 0) {
      setSelectAllCerts(selectedCerts.length === filteredAndSortedCerts.length);
    } else {
      setSelectAllCerts(false);
    }
  }, [selectedCerts, filteredAndSortedCerts]);

  // Update select all certs state when selected certs change
  useEffect(() => {
    if (certs.length > 0) {
      setSelectAllCerts(selectedCerts.length === certs.length);
    } else {
      setSelectAllCerts(false);
    }
  }, [selectedCerts, certs]);

  // Bulk delete selected teachers
  async function bulkDeleteTeachers() {
    if (selectedTeachers.length === 0) {
      setMsg("กรุณาเลือกครูที่ต้องการลบ");
      return;
    }

    const selectedNames = teachers
      .filter((teacher) => selectedTeachers.includes(teacher.id))
      .map((teacher) => teacher.full_name)
      .join(", ");

    if (
      !confirm(
        `ต้องการลบครู ${selectedTeachers.length} คน ใช่หรือไม่?\n\n${selectedNames}\n\nการลบนี้จะลบข้อมูลครูและการเชื่อมโยงหมวดหมู่ทั้งหมด แต่ไฟล์ใบรับรองจะยังคงอยู่`
      )
    ) {
      return;
    }

    try {
      // ลบการเชื่อมโยงหมวดหมู่ก่อน
      await supabase
        .from("teacher_categories")
        .delete()
        .in("teacher_id", selectedTeachers);

      // ลบครู
      const { error } = await supabase
        .from("teachers")
        .delete()
        .in("id", selectedTeachers);

      if (error) throw error;

      setMsg(`✅ ลบครู ${selectedTeachers.length} คน สำเร็จ`);
      setSelectedTeachers([]);
      loadData();
    } catch (error: unknown) {
      setMsg(
        `❌ ลบไม่สำเร็จ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Handle individual cert selection
  function toggleCertSelection(certId: string) {
    setSelectedCerts((prev) =>
      prev.includes(certId)
        ? prev.filter((id) => id !== certId)
        : [...prev, certId]
    );
  }

  // Handle select all certs
  function toggleSelectAllCerts() {
    if (selectAllCerts) {
      setSelectedCerts([]);
    } else {
      setSelectedCerts(certs.map((cert) => cert.id));
    }
    setSelectAllCerts(!selectAllCerts);
  }

  // Bulk delete selected certificates
  async function bulkDeleteCerts() {
    if (selectedCerts.length === 0) {
      setMsg("กรุณาเลือกไฟล์ใบรับรองที่ต้องการลบ");
      return;
    }

    if (
      !confirm(
        `ต้องการลบไฟล์ใบรับรอง ${selectedCerts.length} ไฟล์ ใช่หรือไม่?\n\nการลบนี้จะลบไฟล์ออกจากฐานข้อมูลและ storage อย่างถาวร`
      )
    ) {
      return;
    }

    try {
      // ลบไฟล์จาก storage ก่อน
      for (const certId of selectedCerts) {
        const cert = certs.find((c) => c.id === certId);
        if (cert) {
          const { error: storageError } = await supabase.storage
            .from("submissions")
            .remove([cert.file_path]);

          if (storageError) {
            console.error(
              `Failed to delete file ${cert.file_path}:`,
              storageError
            );
          }
        }
      }

      // ลบข้อมูลจากฐานข้อมูล
      const { error } = await supabase
        .from("certificates")
        .delete()
        .in("id", selectedCerts);

      if (error) throw error;

      setMsg(`✅ ลบไฟล์ใบรับรอง ${selectedCerts.length} ไฟล์ สำเร็จ`);
      setSelectedCerts([]);
      loadData();
    } catch (error: unknown) {
      setMsg(
        `❌ ลบไม่สำเร็จ: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Admin Dashboard
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  จัดการข้อมูลครูและระบบ
                </p>
              </div>
              <div className="flex space-x-3">
                <Link
                  href="/admin/teachers"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  จัดการครูแบบละเอียด
                </Link>
                <Link
                  href="/admin/export"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ส่งออกข้อมูล
                </Link>
                <Link
                  href="/admin/debug-storage"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  ตรวจสอบไฟล์
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">👨‍🏫</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        จำนวนครู
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {filteredTeachers.length}
                        {searchTerm && (
                          <span className="text-sm text-gray-500 ml-1">
                            (จากทั้งหมด {teachers.length} คน)
                          </span>
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">📄</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        ใบรับรองทั้งหมด
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {filteredAndSortedCerts.length}
                        {certSearchTerm && (
                          <span className="text-sm text-gray-500 ml-1">
                            (จากทั้งหมด {certs.length} ไฟล์)
                          </span>
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-bold">📚</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        หมวดหมู่
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {CATEGORIES.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    รายชื่อครู
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    จัดการข้อมูลครูทั้งหมดในระบบ
                  </p>
                </div>
                {selectedTeachers.length > 0 && (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      เลือกแล้ว {selectedTeachers.length} คน
                    </span>
                    <button
                      onClick={bulkDeleteTeachers}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      ลบที่เลือก
                    </button>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="mt-4">
                <div className="flex items-center">
                  <div className="relative flex-1 max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อครู อีเมล หรือ slug..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อครู
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      อีเมล
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ใบรับรอง
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTeachers.includes(teacher.id)}
                          onChange={() => toggleTeacherSelection(teacher.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {editingTeacher?.id === teacher.id ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full border rounded px-2 py-1"
                            />
                          ) : (
                            teacher.full_name
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {teacher.slug}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingTeacher?.id === teacher.id ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full border rounded px-2 py-1"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">
                            {teacher.email || "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingTeacher?.id === teacher.id ? (
                          <div className="flex flex-wrap gap-1">
                            {CATEGORIES.map((cat) => (
                              <label
                                key={cat.slug}
                                className="inline-flex items-center text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={editCats.includes(cat.slug)}
                                  onChange={() => toggleEditCat(cat.slug)}
                                  className="mr-1"
                                />
                                {cat.label}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900">
                            {(catsByTeacher[teacher.id] || [])
                              .map(
                                (slug) =>
                                  CATEGORIES.find((c) => c.slug === slug)?.label
                              )
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {certsByTeacher[teacher.id] || 0} ใบ
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingTeacher?.id === teacher.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={saveEdit}
                              className="text-green-600 hover:text-green-900"
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => startEdit(teacher)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={() =>
                                deleteTeacher(teacher.id, teacher.full_name)
                              }
                              className="text-red-600 hover:text-red-900"
                            >
                              ลบ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTeachers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchTerm
                    ? `ไม่พบครูที่ตรงกับ "${searchTerm}"`
                    : "ยังไม่มีข้อมูลครู"}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="mt-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    แสดงครูทั้งหมด
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Certificates Section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md mt-8">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    จัดการไฟล์ใบรับรอง
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    เลือกและลบไฟล์ใบรับรองที่ไม่ต้องการ
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowCertsSection(!showCertsSection)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    {showCertsSection ? "ซ่อน" : "แสดง"} ไฟล์ใบรับรอง
                  </button>
                  {selectedCerts.length > 0 && (
                    <button
                      onClick={bulkDeleteCerts}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      ลบที่เลือก ({selectedCerts.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Search and Sort Controls */}
              {showCertsSection && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="ค้นหาชื่อไฟล์, ชื่อครู, หรือหมวดหมู่..."
                          value={certSearchTerm}
                          onChange={(e) => setCertSearchTerm(e.target.value)}
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600">เรียงตาม:</label>
                      <select
                        value={certSortBy}
                        onChange={(e) => setCertSortBy(e.target.value as typeof certSortBy)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="date">วันที่อัปโหลด</option>
                        <option value="name">ชื่อไฟล์</option>
                        <option value="teacher">ชื่อครู</option>
                        <option value="category">หมวดหมู่</option>
                      </select>
                      <button
                        onClick={() => setCertSortOrder(certSortOrder === "asc" ? "desc" : "asc")}
                        className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title={certSortOrder === "asc" ? "เรียงจากมากไปน้อย" : "เรียงจากน้อยไปมาก"}
                      >
                        {certSortOrder === "asc" ? "↑" : "↓"}
                      </button>
                    </div>
                  </div>
                  {certSearchTerm && (
                    <div className="text-sm text-gray-600">
                      พบ {filteredAndSortedCerts.length} ไฟล์ จากทั้งหมด {certs.length} ไฟล์
                      <button
                        onClick={() => setCertSearchTerm("")}
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        ล้างการค้นหา
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showCertsSection && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectAllCerts}
                          onChange={toggleSelectAllCerts}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ชื่อไฟล์
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ครู
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        หมวดหมู่
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันที่อัปโหลด
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedCerts.map((cert) => {
                      const teacher = teachers.find(
                        (t) => t.id === cert.teacher_id
                      );
                      const category = CATEGORIES.find(
                        (c) => c.slug === cert.category_slug
                      );
                      return (
                        <tr key={cert.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedCerts.includes(cert.id)}
                              onChange={() => toggleCertSelection(cert.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {cert.file_path.split("/").pop()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {cert.file_path}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {teacher?.full_name || "ไม่พบข้อมูลครู"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {category?.label || cert.category_slug}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(cert.created_at).toLocaleDateString(
                              "th-TH"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.storage
                                    .from("submissions")
                                    .createSignedUrl(cert.file_path, 300);

                                  if (error) throw error;
                                  window.open(data.signedUrl, "_blank");
                                } catch (error: unknown) {
                                  setMsg(
                                    `ไม่สามารถเปิดไฟล์ได้: ${
                                      error instanceof Error
                                        ? error.message
                                        : "Unknown error"
                                    }`
                                  );
                                }
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              ดูไฟล์
                            </button>
                            <button
                              onClick={async () => {
                                if (
                                  !confirm(
                                    `ต้องการลบไฟล์ "${cert.file_path
                                      .split("/")
                                      .pop()}" ใช่หรือไม่?`
                                  )
                                ) {
                                  return;
                                }

                                try {
                                  // ลบไฟล์จาก storage
                                  const { error: storageError } =
                                    await supabase.storage
                                      .from("submissions")
                                      .remove([cert.file_path]);

                                  if (storageError) throw storageError;

                                  // ลบข้อมูลจากฐานข้อมูล
                                  const { error: dbError } = await supabase
                                    .from("certificates")
                                    .delete()
                                    .eq("id", cert.id);

                                  if (dbError) throw dbError;

                                  setMsg(`✅ ลบไฟล์สำเร็จ`);
                                  loadData();
                                } catch (error: unknown) {
                                  setMsg(
                                    `❌ ลบไม่สำเร็จ: ${
                                      error instanceof Error
                                        ? error.message
                                        : "Unknown error"
                                    }`
                                  );
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              ลบ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showCertsSection && filteredAndSortedCerts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {certSearchTerm
                    ? `ไม่พบไฟล์ใบรับรองที่ตรงกับ "${certSearchTerm}"`
                    : "ยังไม่มีไฟล์ใบรับรอง"
                  }
                </p>
                {certSearchTerm && (
                  <button
                    onClick={() => setCertSearchTerm("")}
                    className="mt-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    แสดงไฟล์ทั้งหมด
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          {msg && (
            <div
              className={`mt-6 p-4 rounded-md ${
                msg.startsWith("✅")
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {msg}
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
