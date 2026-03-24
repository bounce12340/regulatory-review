#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regulatory Knowledge Base Admin UI
Streamlit page for managing TFDA regulatory documents.
"""

import streamlit as st
from pathlib import Path
from datetime import datetime
import pandas as pd

# Import knowledge base
from ai.regulatory_kb import get_knowledge_base, RegulatoryDocument


def render_kb_admin_page():
    """Render the regulatory knowledge base admin page."""
    
    st.markdown("""
    <div class="page-header">
        <div class="page-header-badge">📚 法規知識庫管理</div>
        <h1>TFDA 法規文件管理</h1>
        <p class="page-header-sub">上傳、解析並管理 TFDA 官方法規文件，建立 RAG 知識庫</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Initialize knowledge base
    kb = get_knowledge_base()
    
    # Create tabs
    tab1, tab2, tab3 = st.tabs(["📤 上傳法規", "📋 法規列表", "📊 統計資訊"])
    
    # Tab 1: Upload
    with tab1:
        render_upload_section(kb)
    
    # Tab 2: List
    with tab2:
        render_document_list(kb)
    
    # Tab 3: Stats
    with tab3:
        render_stats_section(kb)


def render_upload_section(kb):
    """Render the document upload section."""
    st.markdown("""
    <div class="section-card">
        <div class="section-title">
            <div class="title-icon">📤</div> 上傳新法規文件
        </div>
    """, unsafe_allow_html=True)
    
    with st.form("upload_regulatory_doc"):
        col1, col2 = st.columns(2)
        
        with col1:
            doc_title = st.text_input(
                "法規名稱",
                placeholder="例如：藥品查驗登記審查準則"
            )
            
            doc_type = st.selectbox(
                "法規類型",
                options=[
                    ("drug", "藥品相關"),
                    ("food", "食品相關"),
                    ("medical_device", "醫療器材相關"),
                    ("general", "一般法規")
                ],
                format_func=lambda x: x[1]
            )[0]
        
        with col2:
            doc_source = st.text_input(
                "發布機關",
                value="TFDA",
                placeholder="例如：TFDA、衛福部"
            )
            
            uploaded_file = st.file_uploader(
                "選擇 PDF 文件",
                type=["pdf"],
                help="支援 PDF 格式，建議使用官方 PDF 文件"
            )
        
        # Submit button
        submitted = st.form_submit_button(
            "🚀 開始上傳並解析",
            use_container_width=True
        )
        
        if submitted:
            if not doc_title:
                st.error("❌ 請輸入法規名稱")
            elif not uploaded_file:
                st.error("❌ 請選擇 PDF 文件")
            else:
                # Process upload
                with st.spinner("正在解析文件..."):
                    try:
                        doc = kb.add_document(
                            file_bytes=uploaded_file.getvalue(),
                            filename=uploaded_file.name,
                            title=doc_title,
                            document_type=doc_type,
                            source=doc_source
                        )
                        
                        if doc.status == "completed":
                            st.success(f"✅ 上傳成功！")
                            st.info(f"""
                            📄 文件：{doc.title}
                            🔢 ID：{doc.id}
                            📊 頁數：{doc.total_pages}
                            🧩 分塊數：{doc.total_chunks}
                            """)
                        else:
                            st.error(f"❌ 解析失敗：{doc.error_message}")
                    
                    except Exception as e:
                        st.error(f"❌ 上傳失敗：{str(e)}")
    
    st.markdown("""
    <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin-top:16px">
        <strong>💡 提示</strong><br>
        上傳的法規文件將自動：
        <ul>
            <li>解析 PDF 內容</li>
            <li>分割成適當大小的區塊</li>
            <li>建立向量索引（供 AI 檢索使用）</li>
            <li>儲存到本地知識庫</li>
        </ul>
    </div>
    </div>
    """, unsafe_allow_html=True)


def render_document_list(kb):
    """Render the document list section."""
    st.markdown("""
    <div class="section-card">
        <div class="section-title">
            <div class="title-icon">📋</div> 已上傳法規文件
        </div>
    """, unsafe_allow_html=True)
    
    # Get documents
    docs = kb.list_documents()
    
    if not docs:
        st.info("📭 尚無法規文件，請先上傳")
    else:
        # Create DataFrame
        data = []
        for doc in docs:
            data.append({
                "ID": doc.id,
                "名稱": doc.title,
                "類型": doc.document_type,
                "來源": doc.source,
                "頁數": doc.total_pages,
                "分塊數": doc.total_chunks,
                "狀態": doc.status,
                "上傳時間": doc.upload_date.strftime("%Y-%m-%d %H:%M")
            })
        
        df = pd.DataFrame(data)
        
        # Display table
        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True
        )
        
        # Document actions
        st.markdown("### 文件操作")
        
        col1, col2 = st.columns(2)
        
        with col1:
            selected_doc_id = st.selectbox(
                "選擇文件",
                options=[d.id for d in docs],
                format_func=lambda x: next((d.title for d in docs if d.id == x), x)
            )
        
        with col2:
            action = st.selectbox(
                "操作",
                options=["查看詳情", "刪除文件", "測試檢索"]
            )
        
        if st.button("執行操作", use_container_width=True):
            doc = kb.get_document(selected_doc_id)
            
            if action == "查看詳情":
                if doc:
                    st.json(doc.to_dict())
            
            elif action == "刪除文件":
                if st.confirm(f"確定要刪除「{doc.title}」嗎？"):
                    kb.delete_document(selected_doc_id)
                    st.success("✅ 已刪除")
                    st.rerun()
            
            elif action == "測試檢索":
                query = st.text_input("輸入檢索查詢", placeholder="例如：藥品查驗登記需要哪些文件？")
                if query:
                    results = kb.search(query, n_results=3)
                    st.markdown("### 檢索結果")
                    for i, result in enumerate(results, 1):
                        with st.expander(f"結果 {i}: {result['metadata']['doc_title']}"):
                            st.write(result['content'][:500] + "...")
                            st.json(result['metadata'])
    
    st.markdown("</div>", unsafe_allow_html=True)


def render_stats_section(kb):
    """Render the statistics section."""
    st.markdown("""
    <div class="section-card">
        <div class="section-title">
            <div class="title-icon">📊</div> 知識庫統計
        </div>
    """, unsafe_allow_html=True)
    
    stats = kb.get_stats()
    
    # KPI cards
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            label="總文件數",
            value=stats['total_documents']
        )
    
    with col2:
        st.metric(
            label="已完成解析",
            value=stats['completed']
        )
    
    with col3:
        st.metric(
            label="解析失敗",
            value=stats['error']
        )
    
    with col4:
        st.metric(
            label="向量區塊數",
            value=stats['vector_count']
        )
    
    # Document type distribution
    if stats['by_type']:
        st.markdown("### 文件類型分布")
        
        type_data = []
        for doc_type, count in stats['by_type'].items():
            type_names = {
                'drug': '藥品相關',
                'food': '食品相關',
                'medical_device': '醫療器材',
                'general': '一般法規'
            }
            type_data.append({
                '類型': type_names.get(doc_type, doc_type),
                '數量': count
            })
        
        df_types = pd.DataFrame(type_data)
        st.bar_chart(df_types.set_index('類型'))
    
    # Storage info
    st.markdown("### 儲存資訊")
    st.info(f"""
    📁 知識庫位置：{kb.persist_directory}
    
    向量資料庫使用 ChromaDB，支援持久化儲存。
    所有文件和向量索引都儲存在本地，無需外部服務。
    """)
    
    st.markdown("</div>", unsafe_allow_html=True)


# Export for use in main dashboard
if __name__ == "__main__":
    render_kb_admin_page()
