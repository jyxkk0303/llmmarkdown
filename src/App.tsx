import { useState, useEffect, useRef, useMemo } from 'react'
import './App.css'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { visit } from 'unist-util-visit'

// --- 核心功能：全方位语法自动修复 (智能容错版) ---
const autoFixMarkdown = (text: string, enabled: boolean): string => {
  // 1. 【核心】扩展语法 (!!!) 必须始终执行
  let processedText = text.replace(/!!!(.*?)!!!/g, ':spoiler[$1]');

  if (!enabled) return processedText;

  // 2. 修复未闭合的代码块 (```)
  const codeBlockCount = (processedText.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    // 补全后立即返回，防止代码块吞噬后续修复
    return processedText + '\n```'; 
  }

  // 3. 修复块级公式 ($$)
  const mathBlockCount = (processedText.match(/\$\$/g) || []).length;
  if (mathBlockCount % 2 !== 0) {
    return processedText + '$$';
  }

  // 4. 修复行内元素
  
  // A. 修复行内代码 (`) 
  const lines = processedText.split('\n');
  const lastLine = lines[lines.length - 1] || '';
  const backtickCount = (lastLine.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
      return processedText + '`';
  }

  // B. 修复粗体 (**) - 【升级】增加去空格逻辑，防止演示翻车
  // 检测逻辑：以 ** 开头，后面没有 *，允许结尾有空格
  if (/\*\*[^\*]*\s*$/.test(processedText)) {
      // 智能去除末尾空格再闭合，保证 Markdown 语法有效
      return processedText.trimEnd() + '**';
  }

  // C. 修复链接/图片 ([text](url)
  // 检测逻辑：以 [ 或 ![ 开头，有 ](，但结尾没有 )
  if (/(\!\[|\[)[^\]]*\]\([^\)]*$/.test(processedText)) {
      return processedText + ')';
  }

  return processedText;
};

// --- 自定义插件 ---
function remarkPluginDirectives() {
  return (tree: any) => {
    visit(tree, (node) => {
      if (['textDirective', 'leafDirective', 'containerDirective'].includes(node.type)) {
        const data = node.data || (node.data = {})
        const tagName = node.type === 'textDirective' ? 'span' : 'div'
        data.hName = tagName
        data.hProperties = { ...node.attributes, 'data-directive-name': node.name }
      }
    })
  }
}

// --- Hook: 可调速的平滑流式引擎 ---
function useSmartStream(
    fullText: string, 
    isStreaming: boolean, 
    minSpeed: number, 
    maxSpeed: number
) {
  const [displayBuffer, setDisplayBuffer] = useState('')
  const fullTextRef = useRef(fullText)
  const indexRef = useRef(0)

  useEffect(() => {
    fullTextRef.current = fullText
    if (fullText.length < indexRef.current) {
        indexRef.current = fullText.length
        setDisplayBuffer(fullText)
    }
  }, [fullText])

  useEffect(() => {
    const timer = setInterval(() => {
      const currentTarget = fullTextRef.current
      const currentCursor = indexRef.current
      if (currentCursor < currentTarget.length) {
        const speed = Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + minSpeed
        const charsToAdd = Math.max(1, speed)
        const nextCursor = Math.min(currentCursor + charsToAdd, currentTarget.length)
        indexRef.current = nextCursor
        setDisplayBuffer(currentTarget.slice(0, nextCursor))
      }
    }, 50)
    return () => clearInterval(timer)
  }, [minSpeed, maxSpeed])

  useEffect(() => {
    if (!isStreaming) {
        indexRef.current = fullTextRef.current.length
        setDisplayBuffer(fullTextRef.current)
    }
  }, [isStreaming, fullText])

  return displayBuffer
}

function App() {
  const [input, setInput] = useState(defaultDoc)
  const [isStreaming, setIsStreaming] = useState(true)
  const [enableAutoFix, setEnableAutoFix] = useState(true)
  const [speedConfig, setSpeedConfig] = useState({ min: 1, max: 3 })

  const rawStreamText = useSmartStream(input, isStreaming, speedConfig.min, speedConfig.max)
  const processedText = useMemo(
      () => autoFixMarkdown(rawStreamText, enableAutoFix), 
      [rawStreamText, enableAutoFix]
  )

  return (
    <div className="app-card">
      <header className="header">
        <div className="title-area">
            <h1>Markdown Renderer Pro</h1>
            <span className="subtitle">答辩演示版</span>
        </div>
        <div className="controls">
           <div className="control-group">
             <label>流速: </label>
             <input type="range" min="1" max="5" value={speedConfig.min} onChange={e => setSpeedConfig({...speedConfig, min: Number(e.target.value)})}/>
             <span>-</span>
             <input type="range" min="2" max="10" value={speedConfig.max} onChange={e => setSpeedConfig({...speedConfig, max: Number(e.target.value)})}/>
           </div>
           <label className="checkbox-label" title="开启后会自动闭合未完成的标签">
              <input type="checkbox" checked={enableAutoFix} onChange={e => setEnableAutoFix(e.target.checked)}/>
              <span>开启语法修复</span>
           </label>
           <label className="checkbox-label btn-primary">
              <input type="checkbox" checked={isStreaming} onChange={e => setIsStreaming(e.target.checked)}/>
              <span>{isStreaming ? '正在流式传输...' : '显示完整结果'}</span>
           </label>
        </div>
      </header>

      <div className="editor-body">
        <div className="pane left">
          <div className="pane-title">Input Stream</div>
          <textarea className="input-area" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false}/>
        </div>
        <div className="pane right">
          <div className="pane-title">Live Preview {isStreaming && rawStreamText.length < input.length && <span className="typing-indicator"> ▋</span>}</div>
          <div className="output-area" id="preview-root">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkPluginDirectives]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code({node, inline, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  const content = String(children || '').replace(/\n$/, '')
                  
                  return !inline && match ? (
                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{content}</SyntaxHighlighter>
                  ) : (
                    !inline ? <pre className="code-block-fallback"><code>{children}</code></pre> 
                    : <code className={className} {...props}>{children}</code>
                  )
                },
                div({node, className, ...props}: any) {
                    if (props['data-directive-name'] === 'callout') return <div className={`callout callout-${props.type || 'info'}`}>{props.children}</div>
                    return <div className={className} {...props}>{props.children}</div>
                },
                span({node, className, ...props}: any) {
                    const name = props['data-directive-name']
                    if (name === 'badge') return <span className={`badge badge-${props.type || 'default'}`}>{props.children}</span>
                    if (name === 'spoiler') return <span className="spoiler" title="刮开查看">{props.children}</span>
                    return <span className={className} {...props}>{props.children}</span>
                },
                a({node, href, children, ...props}: any) {
                    const isAnchor = href?.startsWith('#');
                    return (
                        <a href={href} {...props} target={isAnchor ? undefined : "_blank"} onClick={(e) => {
                            if (isAnchor) {
                                e.preventDefault(); e.stopPropagation();
                                try {
                                    const id = decodeURIComponent(href.slice(1));
                                    const target = document.getElementById(id);
                                    const container = document.getElementById('preview-root');
                                    if (target && container) {
                                        const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
                                        container.scrollBy({ top: offset - 20, behavior: 'smooth' });
                                    }
                                } catch (err) {}
                            }
                        }}>{children}</a>
                    )
                }
              }}
            >
              {processedText}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

const defaultDoc = `# 前端 Markdown 渲染器验收报告

本文档旨在全面演示 **Markdown Renderer Pro** 的各项核心能力。

## 1. GFM 扩展语法

### 任务列表与状态管理
- [x] **流式引擎**：支持平滑滚动与速度调节
- [x] **智能修复**：自动闭合代码块与标签
- [ ] **移动端适配**：响应式布局优化

### 宽表格测试
| 功能模块 | 优先级 | 状态 | 负责人 |
| :--- | :---: | :---: | ---: |
| 解析引擎 | P0 | ✅ Done | @CoreTeam |
| 数学公式 | P1 | ✅ Done | @MathTeam |
| 扩展指令 | P2 | 🚀 Beta | @UXTeam |

## 2. 数学公式渲染 (KaTeX)
**行内公式**：质能方程 $E=mc^2$。

**块级公式**：
$$
\\Gamma(z) = \\int_0^\\infty t^{z-1}e^{-t}dt
$$

## 3. 自定义指令系统

### 徽章与提示框
状态：:badge[Stable]{type=success}

:::callout[温馨提示]{type=info}
Callout 组件支持嵌套 **Markdown** 语法。
:::

### 防剧透黑幕 (Spoiler)
!!!警告：凶手就是那个侦探自己!!!

## 4. 交互式验收区 (Auto-fix)

**测试说明**：请在下方依次输入未闭合的语法进行测试。
1. **代码块**：\`\`\`js
2. **粗体**：\`**这是一段粗体\`
3. **公式**：\`$$\`

---
[^1]: 这是一个平滑滚动的脚注演示。
`

export default App
