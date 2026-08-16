import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const UploadTemplate = () => {
    const [templateFile, setTemplateFile] = useState(null);
    const [templateTitle, setTemplateTitle] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [address, setAddress] = useState('');
    const [headerText, setHeaderText] = useState('');
    const [instructions, setInstructions] = useState('');
    const [footerText, setFooterText] = useState('');
    const [watermarkText, setWatermarkText] = useState('');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const navigate = useNavigate();

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleTemplateUpload = async (e) => {
        e.preventDefault();
        const data = new FormData();
        if (templateFile) {
            data.append('template', templateFile);
        }
        data.append('title', templateTitle || (templateFile ? templateFile.name : 'Custom Template'));
        data.append('description', templateDesc);
        data.append('institutionName', institutionName);
        data.append('address', address);
        data.append('headerText', headerText);
        data.append('instructions', instructions);
        data.append('footerText', footerText);
        data.append('watermarkText', watermarkText);

        try {
            setUploading(true);
            await api.post('/api/templates', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Template created successfully!');
            setTemplateFile(null);
            setTemplateTitle('');
            setTemplateDesc('');
            setInstitutionName('');
            setAddress('');
            setHeaderText('');
            setInstructions('');
            setFooterText('');
            setWatermarkText('');
            setPreviewUrl(null);
            fetchTemplates();
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.msg || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await api.delete(`/api/templates/${id}`);
            fetchTemplates();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="animate-fade-in-up max-w-5xl mx-auto space-y-10 px-4 py-8 font-sans">
            {/* Header */}
            <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center">
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2 uppercase tracking-tight">Template Management</h3>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Upload & Manage Institutional Templates</p>
                </div>
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm">← Back</button>
            </div>

            {/* Upload Form */}
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-8 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">↑</span>
                    Create / Customize Template
                </h3>
                <form onSubmit={handleTemplateUpload} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Template Title *</label>
                            <input
                                type="text" required
                                placeholder="e.g. Manchester College Template 2026"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={templateTitle}
                                onChange={e => setTemplateTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Description</label>
                            <input
                                type="text"
                                placeholder="e.g. Custom layout blueprint for semester exams"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={templateDesc}
                                onChange={e => setTemplateDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Institution Name</label>
                            <input
                                type="text"
                                placeholder="e.g. MANCHESTER COLLEGE OF SCIENCE & COMMERCE"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={institutionName}
                                onChange={e => setInstitutionName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Institution Address</label>
                            <input
                                type="text"
                                placeholder="e.g. Main Ring Road, Bangalore"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Exam Header Text</label>
                            <input
                                type="text"
                                placeholder="e.g. SEMESTER EXAMINATION - 2026"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={headerText}
                                onChange={e => setHeaderText(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Footer Text</label>
                            <input
                                type="text"
                                placeholder="e.g. Prepared by department of science"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={footerText}
                                onChange={e => setFooterText(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Watermark Text</label>
                            <input
                                type="text"
                                placeholder="e.g. CONFIDENTIAL"
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                                value={watermarkText}
                                onChange={e => setWatermarkText(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">General Instructions</label>
                        <textarea
                            rows={3}
                            placeholder="Write instructions (one per line)...&#10;e.g. 1. All questions are compulsory.&#10;2. Use of scientific calculators is permitted."
                            className="w-full border-2 border-gray-100 p-4 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                        />
                    </div>

                    <div className="w-full">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Optional Header Logo Image (PNG / JPG)</label>
                        <input
                            type="file" accept="image/*"
                            onChange={(e) => {
                                if (e.target.files[0]) {
                                    setTemplateFile(e.target.files[0]);
                                    setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                                }
                            }}
                            className="w-full border-2 border-gray-100 p-5 rounded-2xl bg-gray-50/50 hover:bg-white focus:border-navy outline-none transition-all shadow-inner font-bold text-navy cursor-pointer file:mr-6 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-navy file:text-gold hover:file:scale-105"
                        />
                    </div>
                    {previewUrl && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
                            <p className="text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Logo Preview</p>
                            <img src={previewUrl} alt="Preview" className="max-h-32 mx-auto object-contain rounded-xl" />
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full bg-gold text-navy py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:shadow-2xl hover:scale-[1.02] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                        {uploading ? 'Processing...' : '+ Save Template Layout'}
                    </button>
                </form>
            </div>

            {/* Uploaded Templates Gallery */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-8 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-navy text-gold w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg">🖼</span>
                    Uploaded Templates ({templates.length})
                </h3>

                {loading ? (
                    <div className="text-center py-10 text-slate/40 font-bold text-sm">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="text-4xl mb-4">🖼️</div>
                        <p className="text-slate/30 font-bold text-xs uppercase tracking-widest">No templates uploaded yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(t => (
                            <div key={t._id} className="group relative bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-navy/20 transition-all">
                                <div className="h-36 bg-white flex items-center justify-center overflow-hidden border-b border-gray-100">
                                    <img
                                        src={t.fileUrl}
                                        alt={t.title || t.originalName}
                                        className="max-h-full max-w-full object-contain p-3"
                                        onError={e => { e.target.src = ''; e.target.parentNode.innerHTML = '<div class="text-4xl">🖼️</div>'; }}
                                    />
                                </div>
                                <div className="p-5">
                                    <h4 className="font-black text-sm text-navy truncate">{t.title || t.originalName}</h4>
                                    {t.description && <p className="text-[10px] text-slate/50 mt-1 font-medium leading-relaxed">{t.description}</p>}
                                    <p className="text-[9px] font-bold text-slate/30 uppercase tracking-widest mt-2">
                                        {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="absolute top-3 right-3 hidden group-hover:flex gap-2">
                                    <a href={t.fileUrl} target="_blank" rel="noreferrer"
                                        className="bg-navy text-gold text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-navy/80 transition">
                                        View
                                    </a>
                                    <button
                                        onClick={() => handleDelete(t._id)}
                                        className="bg-red-500 text-white text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-red-600 transition">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadTemplate;
