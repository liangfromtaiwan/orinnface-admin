# shadcn MCP 使用規範

## 重要：MCP 是「事實來源」

本專案已配置 shadcn MCP server（見 `.mcp.json`）。
**任何 shadcn 元件相關問題,必須優先透過 MCP 查詢**,
不要依賴記憶中的元件 API。

## 強制查詢時機

以下情境**必須**先呼叫 MCP 工具:

1. **使用任何 shadcn 元件之前**:確認元件的最新 API、props、children 結構
2. **使用者要求新增元件**:用 MCP 取得正確的安裝指令
3. **不確定某個功能是否存在**:查 MCP 而不是猜
4. **要套用 block(整套模板)**:用 MCP 取得最新的 block 實作

## 標準工作流程

### 場景 A:使用者說「加一個 X 元件」

```
1. 用 MCP 的 search 工具確認元件存在
2. 用 MCP 的 get 工具取得元件詳細資訊
3. 確認專案是否已安裝(查 components-installed.md)
4. 未安裝 → 提示使用者執行 `npx shadcn@latest add X`
5. 已安裝 → 直接使用,但仍以 MCP 取得的 API 為準
```

### 場景 B:使用者貼一張畫面截圖

```
1. 列出畫面上看到的元件
2. 用 MCP 確認每個元件的正確 props
3. 對照 components-installed.md 列出缺少的元件
4. 提供完整安裝指令(一次裝齊缺的)
5. 寫 code,**props 名稱以 MCP 回傳的為準**
```

### 場景 C:使用者要做整個頁面

```
1. 先用 MCP 看看有沒有現成的 block 可以用
   - dashboard-01、sidebar-07、login-04 等
2. 有合適 block → 用 MCP 取得實作,在此基礎上客製
3. 沒有 block → 用本專案的 patterns/*.md 範本
```

## 禁止行為

- ❌ 「我記得 Button 有 loading prop...」(查 MCP!)
- ❌ 「shadcn 應該有 DatePicker 元件」(查 MCP 確認)
- ❌ 直接複製網路上找到的 shadcn 範例(可能過時)
- ❌ 寫完 code 才發現 prop 名稱錯了(寫之前就要查)

## 與 components-installed.md 的關係

- **MCP**:告訴你「shadcn 官方提供什麼」(完整目錄)
- **components-installed.md**:告訴你「本專案裝了什麼」(實際可用)

兩者要交叉比對:
- MCP 說有 → 但 components-installed.md 沒勾 = 要先安裝
- components-installed.md 有勾 → 可以直接 import 使用

## 安裝新元件後的義務

每次協助使用者安裝新元件:
1. 確認指令成功執行
2. **主動更新 `.claude/components-installed.md`**(把對應項目打勾)
3. 如果是客製複合元件,加到「客製元件清單」

## MCP 工具速查

官方 shadcn MCP 提供的主要工具:
- `list_components` - 列出所有可用元件
- `get_component` - 取得單一元件的源碼與 API
- `search_components` - 關鍵字搜尋
- `get_block` - 取得整套 block 模板
- `get_install_command` - 取得正確的安裝指令

> 實際工具名稱可能因 MCP 版本不同,以 `/mcp` 查詢結果為準。
