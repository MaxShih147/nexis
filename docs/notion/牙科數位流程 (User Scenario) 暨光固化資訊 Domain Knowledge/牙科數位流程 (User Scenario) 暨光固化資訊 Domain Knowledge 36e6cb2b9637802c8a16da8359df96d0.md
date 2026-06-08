# 牙科數位流程 (User Scenario) 暨光固化資訊 Domain Knowledge

三大廠商：EXOCAD、Medit 、3Shape

- 前言
    - 數位流程導入
        
        
        |  項目             |  內容                                                                                                                                    |
        | --- | --- |
        |  最需優先處理的項目 | 數位流程導入失敗大多來自於先選技術再談流程 （應該要先了解流程，分析需要改善的地方，再研究有哪些工具/技術可以優化/解決，最後才進行採購與導入） |
        |  最痛的點 | 失敗診所多為先採購設備與軟體再套進既有流程
        文獻中表示有 89% 失敗
        41% 在 18 個月內放棄，做錯一次整筆投資與士氣皆受創，屬「一開始就要做對」的痛 |
        |  量化或質化數據    | **73%** 診所導入數位流程第一年效率下降
        **41%** 在 18 個月內放棄數位計畫
        **89%** 失敗案例為「先選技術再談流程」 |
        |  佐證資料與參考文獻 |  [Align3D 分析 347 家牙科診所]
        https://align3d.io/why-digital-workflows-fail-and-how-to-fix-them-in-30-days/ |
- 四種牙科應用模式
    - 階段定義說明
        
        
        | 階段 | 涵蓋範圍 |
        | --- | --- |
        | **進入切片軟體前** | 主要是在CAD內完成設定之所有步驟。比如：取得資料 → CAD／規劃（規劃、影像對位與規劃、設計）→ 醫師／病患確認（若適用）→ 匯出 STL／加工檔為止等 |
        | **切片軟體中** | 主要是在切片軟體內完成之設定與輸出。比如：列印前處理：orientation、支撐、Base／內部填充（正畸）、公差補償（導板）、排版、切片；或銑削路徑設定（臨時冠選 CNC 時）等 |
        | **切片軟體後** | 主要是實體製造、後處理與臨床交付。比如：3D 列印／銑削 → 清洗、固化、去支撐／分離工件 → 打磨拋光 → 試戴／臨床使用（熱壓、切割拋光、置入套環、滅菌等）→ 術後追蹤等 |
    - 牙科模式
        1. 用途：當作**壓出隱形牙套的實體模具**，以及診斷、溝通與紀錄用模型。
            
            ![截圖 2026-03-12 晚上11.28.18.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E6%99%9A%E4%B8%8A11.28.18.png)
            
        2. 工作流程
            - 流程圖
                
                ![截圖 2026-03-12 下午2.08.25.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E4%B8%8B%E5%8D%882.08.25.png)
                
            - 步驟說明
                1. **口腔掃描**：用掃描機幫牙齒拍「立體照片」，電腦裡就有牙齒的 3D 樣子。
                2. **建立數位模型**：把掃描的資料變成電腦裡可以編輯的 3D 牙齒模型。
                3. **牙齒分割**：在規劃軟體裡把每顆牙齒分開選取（或自動分割），之後才能一顆一顆排牙。
                4. **排牙設計**：在電腦裡把牙齒虛擬移動到目標位置。
                5. **附著體設計、IPR 規劃、過矯正**：這三項是排牙設計階段的三種**情境**，依個案**並行或選做**（非固定順序）
                    1. 附著體＝豆豆位置與形狀；
                    2. IPR＝鄰面去釉的量與位置；
                    3. 過矯正＝多移一點抵銷回彈。
                6. **階段模擬**：把整體移動拆成「第一步、第二步……」很多階段，每階段對應一副牙套。
                7. **生成各階段模型**：每一個階段都做出一個獨立的牙齒模型檔案。
                8. **基座與標籤（底盤在這裡加）**：每個模型底下加一個站得穩的底盤，再寫上是第幾步、誰的；底盤通常在規劃軟體裡加好。
                9. **醫師確認**：醫師或技師在軟體裡審核排牙、附著體、IPR、階段；同意就核准，不同意就退回修改；核准後才能與病患確認或匯出。
                10. **與病患確認治療計畫與效果**：跟病患確認最終的治療計劃與預計效果（如模擬或動畫）；病患同意後再匯出、進入製作。
                11. **匯出 STL/OBJ**：把這些模型存成列印機讀得懂的檔案。
                12. **方向**：先決定模型在列印機裡要怎麼擺放（角度對了比較好印）。
                13. **Base**：在切片軟體裡加好或確認底盤（讓模型站得穩）。
                14. **內部填充**：可決定模型要做實心或填充
                15. **排版**：把很多階段模型排在同一個建構平台上，不重疊、不超界；這通常是切片前最後一動。
                16. **切片**：把 3D 模型切成一層一層，產出列印機需要的資料。
                17. **3D 列印**：列印機印出一排排牙齒模型。
                18. **清洗與二次固化**：洗掉黏黏的樹脂，再照光讓它變硬。
                19. **熱壓成型隱形牙套**：用這些模型壓出透明的隱形牙套。
                20. **切割邊緣與拋光**：熱壓完的牙套會多出一大圈，要沿牙齦邊剪掉多餘的，剪完的邊緣磨滑，才不壓牙齦、不刮嘴。
                21. **消毒包裝與臨床配戴**：消毒包好，就可以給病人戴啦。
                22. **進度追蹤**：之後要回診或上傳掃描／照片，看牙齒有沒有照計畫移動、牙套有沒有密合；必要時做 IPR、貼豆豆或重掃做新牙套；醫生會記錄你戴到第幾副、什麼時候換副。
        3. 潛在可能可以優化的方向（這段真的是僅供參考，有待進一步確認、討論 和 研究）
            - 進入切片軟體前
                
                
                | 可優化的項目 | 痛點            | 量化或質化數據        | 競品主流軟體支援現況（可做到什麼／還差多少）    | 佐證資料與參考文獻 |
                | --- | --- | --- | --- | --- |
                | 治療規劃與階段設計難全自動  | 每案都要做排牙與 staging，多數仍須手動改；耗時、負擔重，直接壓縮每日產能與人力。預測難準、階段設計需考慮三維位移與力學與安全步距，自動結果常太保守或步距不當須手動調；軟體間不一致難以完全信賴自動結果。  | 文獻評估 **13 套**商用軟體後僅 **1 套**達完整工作流自動化（審閱未於可取得摘要中指名廠牌）；同一治療參數下不同軟體虛擬設定與結果有**統計顯著差異**。 **為何 staging 多數仍須手動修改**： 
                ① **預測難準**—軟體模擬的「治療後牙齒最終位置」與病人實際戴完牙套後的結果常有明顯差距；原因在於許多會影響牙齒移動的因素（例如：骨頭如何改建、牙周狀況、病人每天實際戴用時數等）難以全部納入軟體計算； 
                
                ② **階段設計難全自動**—需考慮三維位移與旋轉、力學、安全步距；**為何自動算出的階段常不理想**：軟體須同時滿足「每顆牙每步移多少、怎麼轉」「力學是否合理」「安全步距」（每步移動量過大易傷牙根或疼痛，過小則牙套副數過多），演算法難以在每案都做出最適取捨，故自動結果常太保守、太激進或步距不當，須手動調每顆牙每步的位移／旋轉、副數、步距；使用者須懂一點力學與安全步距否則不敢只信自動結果； 
                
                ③ **軟體間不一致**—同一治療參數下不同軟體之虛擬設定與結果有統計顯著差異，難以完全信賴自動結果。  | **競品現況**：3Shape Clear Aligner Studio、uLab 具自動 setup／staging 輔助（auto base、auto segmentation、way-points、碰撞偵測），多數仍須手動微調。
                
                **還差**：全案可用的高精度全自動 staging、力學與安全步距一鍵優化；文獻指僅 1 套達完整工作流自動化。  | [ScienceDirect 審閱（2025）AI in clear aligner therapy](https://www.sciencedirect.com/science/article/pii/S0300571225000107)；[BMC Oral Health 軟體比較](https://bmcoralhealth.biomedcentral.com/articles/10.1186/s12903-025-07405-0) |
                |  牙齒分割精度與速度不足    |  每案必經，自動化不足則每案多一段重複勞動，量一大即成瓶頸。複雜病例（擁擠、掃描品質差）下演算法結果不穩常需手動修；牙齒與牙齦邊界不清時易分錯顆或黏在一起；實務仍常見需人工修正、尚未完全取代人工。      |  精度：IoU 約 **0.87–0.98**；單一病例分割時間文獻自**數秒至約 150 秒**，人工分割可達**數小時**。                                                                                                                                                                                                                                                                                                                                                                                                               |  **競品現況**：3Shape、uLab 等有自動牙齒分割，速度數秒～約 150 秒、IoU 約 0.87–0.98。
                
                **還差**：擁擠、掃描品質差等複雜病例下穩定不需手動修；邊界不清時仍易分錯。                                                                              |                                                                                                     [ScienceDirect 審閱（2025）AI in clear aligner therapy](https://www.sciencedirect.com/science/article/pii/S0300571225000107) |
                |  數位模型對位誤差管控  |  CBCT 與口掃對齊合併之誤差需嚴格控制（約 0.17–0.30 mm）；對位誤差會累積進後續 staging 與列印，影響牙套密合與療效。軟體多未內建誤差警示、雙影或錯位即時偵測。     |  誤差需控制在約 **0.17–0.30 mm**。                                     |  **競品現況**：3Shape 等 CAD 支援 CBCT／口掃對位與合併，使用者自行管控誤差。
                
                **還差**：內建誤差警示與達標提示（如 0.17–0.30 mm）；對位完成後多未內建自動偵測「雙影」或「錯位」並即時警示，多依使用者目視確認。  |                                                                              [ScienceDirect 審閱（2025）AI in clear aligner therapy](https://www.sciencedirect.com/science/article/pii/S0300571225000107) |
            - 切片軟體中
                
                
                | 可優化的項目 | 痛點 | 量化或質化數據         | 競品主流軟體支援現況（可做到什麼／還差多少） | 佐證資料與參考文獻 |
                | --- | --- | --- | --- | --- |
                | 檔名混亂與批次排版耗時     | 多階段模型需一次排版，手動排版耗時且易重疊／超界；流程與階段辨識混亂、檔名與工單不一致皆會導致混件或重做，拉長交期。切片檔名需與工單（患者 ID、階段序號）一致；檔名管送印與紀錄，壓字管取件與熱壓時實物防呆。 | 設計與列印準備（含切片、方向、支撐、排版等）約 **10–20 分鐘**；其中 aligner shell 生成 **2–5 分鐘**。一次印出該病例**全部階段模型**較常見。 **工單（患者 ID、階段序號）實務格式例**：案號＋患者識別＋階段序號，例如 `2025-0305-Wang-01`（日期-患者-第1副）、`PT12345_S01`（病歷號_階段01）、`A1234_Stage_01`（案號_Stage_第1副）；切片檔名與工單一致可防混件與交付錯誤。 **檔名 vs 模型上壓字**：**檔名**為數位端辨識（送印佇列、歸檔、紀錄）；**壓字**為在實體列印出的模型（常為底座）上刻／壓患者 ID、階段序號，用於列印後、熱壓前從實物辨識—同一版上多件時尤其需要。實務上兩者常**並存**：檔名管送印與紀錄，壓字管取件與熱壓時的實物防呆；許多技工所／診所會同時採用，壓字在隱形牙套多階段同版列印情境相當常見。 |  **競品現況**：Chitubox Dental 有正畸模型用 Automatic Process（orientation、hollowing、layout）、高密度 nesting 建議；檔名多為手動或簡單規則。
                
                **還差**：工單綁定之變數命名（患者 ID、階段序號）與一鍵批次排版防重疊／超界。                                                                | [Luxcreo 同日流程](https://luxcreo.com/how-to-use-a-dental-3d-printer-complete-digital-workflow-from-scan-to-same-day-delivery/)
                
                [Chitubox Dental operations](https://support.dental.chitubox.com/en-US/user-manual/latest/ui-and-features/operations)
                
                [ifun3d 牙科排版 nesting](https://ifun3d.com/blog/3d-printing/dental/dental-3d-printing-nesting-strategies) |
                | B
                a
                s
                e 確認與一鍵生成底座  | 部分 STL 來自未帶底座的 CAD 或他院匯出，需在切片階段補底座。底座缺失或誤改會導致列印無法就位（塌陷、翹曲）或熱壓失敗（模型放不進治具、片材無法貼合）；多數 3Shape/uLab 已帶 Base，約二至三成需在切片確認或補底座。切片端多不內建一鍵補底座。  | 質化：「Base 生成」多數在 CAD 完成，少數在切片軟體補底座。 **實務上進切片軟體時，有良好底座 vs 無／需補底座之比例**：文獻與原廠**未提供產業統一數據**；依流程與原廠描述（3Shape、uLab 匯出前多已帶 Base；他院或未帶底座 STL 需在切片補），可理解為**多數已帶底座、少數需確認或補底座**。若以量級粗估（即不追求精確數字、僅依「多數／少數」推估大略區間，非文獻統計）：**約七成以上**進切片時已具可用底座（多為 3Shape／uLab 等規劃軟體匯出）、**約二至三成**需在切片階段確認或補底座（他院、未帶底座 STL 或匯出設定未含 Base）；**實際比例依各單位案源與軟體組合而異**，建議以貴單位內部統計（依案數或批次）為準並可填於此：____。 |  **競品現況**：3Shape、uLab 在 CAD 端已帶 Base；Chitubox 等切片軟體多不內建補底座。
                
                **還差**：切片端**一鍵補底座**（針對他院或未帶 Base 的 STL）。                                                                                                                   | [3Shape Clear Aligner Studio workflow](https://support.3shape.com/products-ortho-system-how-to/3shape-clear-aligner-studio-workflow-on-ortho-system)
                
                [uLab uDesign Cloud](https://www.ulabsystems.com/ulab-systems-launches-udesign-cloud-2-0-bringing-segmentation-self-planning-and-cloud-based-printing-together-in-one-flexible-aligner-platform/) |
                | 模型上壓字／一鍵壓字或標記   | 多階段同版列印時取件、熱壓、出貨需從實物辨識階段與患者；壓字多壓在底座上。若 STL 未含壓字幾何僅能依位置或手寫，易混件。切片端多無法補壓字，需回 CAD 或列印後手寫／貼標；缺一鍵壓字綁定工單變數或偵測 STL 是否已具壓字。                   | 質化。流程圖將「**基座與標籤**」列為正畸流程正式步驟（為每個階段模型加底盤、患者 ID、階段編號，方便列印與識別）；多數在 **CAD**（3Shape、uLab）完成；若 STL 來自他院或匯出未含壓字，**切片端多無法補**，需回 CAD 或列印後手寫／貼標。隱形牙套**多階段同版列印**情境下，壓字在技工所／診所**相當常見**，與檔名並存（檔名管送印與紀錄，壓字管**取件與熱壓時實物防呆**）。 **壓字通常壓在哪裡**：多壓在**底座**上（模型底部之馬蹄形或平台狀底座），因底座面積大、較平整、不影響牙弓與熱壓接觸面；亦有壓在底座側緣或背面，視 CAD 設定與列印方向而定。 **壓字重要性**：同一建構板上多個模型列印完成後，取件、依序熱壓、出貨時必須從實物辨識「哪個是哪位患者、第幾階段」；僅靠檔名或排版位置圖易出錯，壓字為實物防呆之主要做法。 **實務上常見的壓字／標記格式範例（正畸模型）**：
                ① **日期＋患者＋階段序號**，如 `2025-0305-Wang-01`、`0305 王大明 第1副`；
                
                ② **病歷號／案號＋階段序號**，如 `PT12345_S01`、`A1234_Stage_01`、`MRN123456 01`；
                
                ③ **患者簡碼＋副數**，如 `WDM-01`、`案001-第1副`。階段序號常見為兩位數（01、02…）或「第 n 副」；可與工單／切片檔名一致，以利數位與實物對應。  |  **競品現況**：3Shape、uLab 在 CAD 端可加底座與標籤（含壓字幾何）；Chitubox（赤兔）有 **Tagging：Add text labels to models**，可在模型上加文字標籤幾何，列印後實物帶有該文字，屬**模型上壓字／標記**功能。
                
                **還差**：切片端**一鍵壓字**綁定工單變數（如患者 ID、階段序號）自動帶入、或偵測 STL 是否已具壓字；赤兔 Tagging 需手動輸入文字。  | [3Shape Clear Aligner Studio workflow](https://support.3shape.com/products-ortho-system-how-to/3shape-clear-aligner-studio-workflow-on-ortho-system)
                
                [uLab uDesign Cloud](https://www.ulabsystems.com/ulab-systems-launches-udesign-cloud-2-0-bringing-segmentation-self-planning-and-cloud-based-printing-together-in-one-flexible-aligner-platform/) |
            - 切片軟體後
                
                
                | 可優化的項目 | 痛點 | 量化或質化數據 | 競品主流軟體支援現況（可做到什麼／還差多少） | 佐證資料與參考文獻 |
                | --- | --- | --- | --- | --- |
                |  交期與醫師製作端溝通  | 醫師與製作端缺乏單一即時管道，需求與修改未在同一平台傳遞易遺漏或誤解，導致重做、追單與延遲；交期過長侵蝕利潤，傳統外包服務費用高。  |  質化：需求與修改若未在**同一平台與格式**傳遞易遺漏或誤解，導致重做、追單與延遲。製造瓶頸含列印校正、品管；傳統外包**逾 1 個月**常見；QuiteClear 自稱 24–48 小時出貨（自生產開始）。  |  **還差**：醫師在 3Shape／uLab 完成設計並匯出後，無法在該軟體或與之串接的單一介面內完成：送出訂單、查看製作端進度（如已列印到第幾副、是否已熱壓）、傳遞修改需求與接收回覆；QuiteClear 等訂單／進度 Dashboard 為獨立網頁或系統，未與 3Shape／uLab 整合，醫師須另開瀏覽器或靠電話／通訊軟體傳遞，易遺漏或延遲。  | [QuiteClear：Improving Lead Times in Clear Aligner Production](https://quiteclear.io/improving-lead-times-in-clear-aligner-production-what-orthodontic-practices-need-to-know/)
                
                [ClearMoves：Digital Workflows & 3D Printing in Aligner Production](https://clearmovesaligners.com/digital-workflows-and-3d-printing-in-aligner-production/) |
    - 手術導板
        1. 用途：手術時戴在病人口內，**引導鑽針的位置、角度與深度**，確保植體打在預定的位置、避開神經與上顎竇。為了之後能裝上**穩定、好看、咬合正確的最終假牙（單顆牙冠／牙橋／活動假牙）**
            
            ![截圖 2026-03-12 晚上11.27.12.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/06cc9593-bd68-4038-baa7-13cd2d840bee.png)
            
        2. 工作流程
            - 流程圖
                
                ![截圖 2026-03-12 下午2.13.49.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E4%B8%8B%E5%8D%882.13.49.png)
                
                **植體、支台、牙冠架構（由上而下：可見修復體 → 連接件 → 骨內植體）**
                
                ![截圖 2026-03-12 下午6.25.34.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E4%B8%8B%E5%8D%886.25.34.png)
                
            - 步驟說明
                1. **口腔表面掃描 IOS**：掃描嘴巴裡的牙齒，得到牙齒的 3D 圖。
                2. **CBCT 骨骼掃描**：照 X 光看骨頭裡面長怎樣 以及 神經, 上顎竇所在位置
                3. **匯入 IOS STL**：把牙齒的 3D 圖載入規劃軟體。
                4. **匯入 CBCT DICOM**：把骨頭的影像載入，和牙齒圖放在同一個軟體裡。
                5. **初步對位**：先把牙齒圖和骨頭圖大概對齊。
                6. **精細配準**：用電腦把兩張圖對得更準，誤差要很小。
                7. **確認對位品質**：檢查有沒有對歪、雙影，沒問題才繼續。
                8. **標記解剖禁區**：在電腦上畫出「神經, 上顎竇在哪裡不能碰到」等禁區。
                9. **選擇植體系統與尺寸**：選假牙根的廠牌、粗細、長度。
                10. **規劃植體位置**：在骨頭裡虛擬放好假牙根的位置，避開禁區。
                11. **規劃植體角度與深度**：調好假牙根要鑽的角度和深度。
                12. **虛擬修復體**：**可選**先畫好未來假牙的樣子，再決定假牙根怎麼擺。
                13. **設計導板本體（觀景窗可選）**：設計「套在牙齒上的板子」的形狀和範圍；需要的話可以留觀景窗（開口），並加標籤（誰的、哪一側等）。
                14. **放置金屬套環孔位**：板子上挖洞，洞的位置就是等一下要鑽的地方，洞裡要放金屬環，讓鑽頭有「金屬導引」不會把板子磨壞。
                15. **檢查導板就位**：在電腦裡試戴導板，確認密合、不會卡到。
                16. **匯出導板 3D 檔**：把這塊板子的 3D 圖存成列印機讀得懂的檔案。
                17. **列印前處理**：把檔案送進切片軟體，準備列印。
                18. **Orientation、支撐、切片**：選好角度、加好支撐，切好片送給列印機。
                19. **3D 列印生醫導板樹脂**：列印機印出那塊板子。
                20. **清洗與 UV/二次固化**：洗乾淨、照光變硬。
                21. **置入金屬定位環**：把小小的金屬環塞進板子上的洞裡；若設計時還沒加標籤，記得在板子上貼標籤或寫字（誰的、哪一側）。
                22. **高壓滅菌後手術使用**：板子消毒後，手術時醫生套在病人牙齒上，照著洞洞的位置鑽，就不會鑽歪啦。
                23. **術後追蹤**：手術後要回診看傷口癒合、骨頭有沒有長好，之後再做二期（若需要）和最終假牙。
        3. 潛在可能可以優化的方向（這段真的是僅供參考，有待進一步確認、討論 和 研究）
            - 進入切片軟體前
                
                
                | 可優化的項目 |  痛點 | 量化或質化數據                       | 競品主流軟體支援現況（可做到什麼／還差多少）   | 佐證資料與參考文獻                                                               |
                | --- | --- | --- | --- | --- |
                | 影像對位與規劃負擔  | 對位、神經標注、植體規劃、導板本體與套環孔位設計均影響最終精度；累積誤差鏈之一環，規劃錯誤會直接傳遞至導板與手術。步驟耗時（合計約 12–20 分鐘）、需專業訓練，任一環節出錯都會傳遞至手術，對操作者形成時間、專注力與責任負擔。目前多須逐步操作，缺進一步自動化。  | 數位取像（口掃＋CBCT）約 **5–10 分鐘**；影像對位與規劃／手術導板設計（2-1～2-14）約 **12–20 分鐘**（對位約 3–5 分鐘、神經與植體規劃約 5–10 分鐘、導板本體與匯出約 4–5 分鐘）。  | **競品現況**：3Shape Implant Studio 整合 DICOM/STL 對位、神經標注、植體規劃、導板與套環設計，可匯出至列印／銑削。
                
                **還差**：**進一步自動化**—指例如對位之一鍵或半自動建議、神經／禁區之自動或輔助描繪、植體位置之 AI 建議、導板本體與套環之一鍵套版等；目前上述步驟多仍須操作者逐步操作，若進一步自動化可縮短整體 12–20 分鐘。**AI 輔助對位與規劃仍在發展**：文獻指出目前手術導板設計以半自動化為主，尚無經科學驗證之全自動 AI 設計（ScienceDirect 2025 審閱）。  | [SprintRay Guide to 3D Printing Surgical Guide](https://sprintray.com/guide-to-3d-printing-surgical-guide/)
                
                [3Shape Implant Studio](https://www.3shape.com/en/software/implant-studio)
                
                [ScienceDirect 2025：AI-driven automation in static surgical guide design（scoping review）](https://www.sciencedirect.com/science/article/pii/S0300571225006359) |
                | 對位品質確認     | STL 與 DICOM 需精細配準（誤差常見＜0.3 mm），確認無錯位或雙影。對位為誤差鏈起點，錯位或雙影會放大至植體位置偏差。軟體多未內建自動顯示配準誤差達標／未達標提示，使用者須自行依畫面或量測判斷。                              |  誤差常見**＜0.3 mm**。                                                                                                 |  **競品現況**：3Shape Implant Studio 支援 STL/DICOM 配準，品質由使用者確認。
                
                **還差**：自動對位品質檢查與雙影／錯位警示；配準完成後，軟體多**未內建**自動顯示「配準誤差＜0.3 mm」或「已達標／未達標」之提示，使用者須自行依畫面或量測判斷是否可接受。                      | [3Shape Implant Studio](https://www.3shape.com/en/software/implant-studio)
                
                [3Shape Support: Implant Studio & Implant Planner](https://support.3shape.com/implant-studio-implant-planner)
                
                [SprintRay Guide to 3D Printing Surgical Guide](https://sprintray.com/guide-to-3d-printing-surgical-guide/) |
            - 切片軟體中
                
                
                | 可優化的項目 | 痛點                                                                                                | 量化或質化數據               | 競品主流軟體支援現況（可做到什麼／還差多少）       | 佐證資料與參考文獻 |
                | --- | --- | --- | --- | --- |
                | 支撐避開套環孔與套入面  | 支撐設計不當易損及套入面或套環區，影響導板就位與鑽孔精度。產業與原廠明確建議避開；多數仍為通用支撐編輯，缺導板情境下套入面／套環區為禁區的一鍵預設。                          | 質化：不同生醫樹脂與支撐設計影響列印精度與就位；產業與原廠明確建議避開套環孔與套入面。       |  **競品現況**：Chitubox Dental 有「Auto support excluding round holes」可避免支撐進鑽孔；SprintRay 等提供支撐建議。
                
                **還差**：導板情境下**套入面／套環區為禁區**的一鍵預設與明確提示；多數仍為通用支撐編輯。             | [SprintRay Guide to 3D Printing Surgical Guide](https://sprintray.com/guide-to-3d-printing-surgical-guide/)
                
                [Chitubox 導板處理](https://support.dental.chitubox.com/en-US/tutorials/proficiency/how-to-process-surgical-guides-before-printing) |
                | 導板標籤／壓字與辨識   | 導板外觀相似度高，若無明顯標示，術前與術中皆有誤用他人或錯側導板之風險。實務多在導板外側不接觸牙齒／黏膜的一面做浮雕文字（患者、牙位、左右側）。缺導板情境下一鍵套用標籤模板與檢查是否具備清楚標識。  | 質化：實務上多在導板外側不接觸牙齒／黏膜的一面（如頰側或外側平面）做浮雕文字標籤（患者、牙位、左右側），或於列印後加貼標籤；內側就位面與鑽孔區通常不壓字，以免影響就位與鑽孔精度。 
                
                **實務上常見的壓字
                格式例**：
                ① **患者＋牙位＋側別**，如 `王大明 #46 R`、`PT12345 36 L`；
                
                ② **案號／病歷號＋牙位區段＋左／右**，如 `A2025-0305 36-37 右`、`MRN123456 #11-21`；
                
                ③ **簡碼**（診所內部代碼＋牙位＋L／R），如 `WDM_46_R`、`案001_下顎右側`。牙位可用 FDI 二位數（如 36、46）或 Universal 編號；側別可用 R／L、右／左、Right／Left。  |  *競品現況**：3Shape Implant Studio 等於設計導板本體時可加入文字或標籤幾何；部分切片軟體（如 Chitubox Tagging 功能）可在模型上新增文字標籤。
                
                **還差**：導板情境下一鍵套用標籤模板（如自工單自動帶入患者與牙位資訊、預設壓在外側安全區），以及檢查導板是否至少具備一組清楚的患者／牙位標識。  | [3Shape Implant Studio](https://www.3shape.com/en/software/implant-studio)
                
                [SprintRay Guide to 3D Printing Surgical Guide](https://sprintray.com/guide-to-3d-printing-surgical-guide/)
                
                Chitubox Dental Tagging 說明（Add text labels to models） |
    - 咬合版/牙合墊
        1. 用途：像一個透明的「**口內防護板**」，長期配戴在口中，用來：
            1. 分散或限制過大的咬合力（例如磨牙症）
            2. 調整或穩定咬合關係、減輕關節或肌肉症狀
            3. 保護牙齒與修復體不被磨耗
                
                ![截圖 2026-03-12 晚上11.35.36.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E6%99%9A%E4%B8%8A11.35.36.png)
                
        2. 工作流程
            - 流程圖
                
                ![截圖 2026-03-12 下午2.20.29.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E4%B8%8B%E5%8D%882.20.29.png)
                
            - 步驟說明
                1. **口掃或取模**：用口掃或軟軟的黏土取模，得到整口牙齒的 3D 樣子。
                2. **匯入上顎／下顎掃描檔**：把上排牙、下排牙的掃描檔丟進電腦的設計軟體裡。
                3. **識別牙弓與咬合**：讓電腦認得哪邊是上、哪邊是下、要咬到的牙在哪裡。
                4. **虛擬咬合器／咬合對位**：在電腦裡讓上下牙像嘴巴裡一樣咬在一起，看看哪裡會碰到。
                5. **決定覆蓋範圍與厚度**：決定要蓋到哪裡、要多厚（幾毫米），醫師會依處方與適應症指定。
                6. **設計咬合板本體（罩蓋）**：做出罩在牙齒上的殼，裡面留一點點小空隙，戴上去才不會太緊。
                7. **咬合面成形**：把咬的那一面弄平或做導引溝槽／斜面，讓咬起來符合設計。
                8. **邊緣修整**：把邊邊修順、不要太尖太長，戴起來才不會磨到牙齦或臉頰。
                9. **檢查厚度**：確認各處厚度符合要求；磨牙較厲害的人常需要更厚一點。
                10. **可選：內部紋理或通氣**：有些軟體可在裡面做一點紋路或小通氣道，讓配戴或排氣更舒服。
                11. **匯出 STL/OBJ**：把設計好的 3D 檔存成列印機讀得懂的格式。
                12. **列印前處理**：把檔案送進切片軟體，準備列印。
                13. **orientation、支撐、切片**：定好板子怎麼擺、從哪邊長支撐，切出切片檔給列印機用。
                14. **3D 列印透明樹脂**：用透明樹脂印出那塊咬合板或牙合墊。
                15. **清洗與二次固化**：洗乾淨，再用紫外線燈照一照，讓它更硬、更耐用。
                16. **試戴、咬合紙調整、拋光**：戴上後用咬合紙找早接觸，哪裡太高就磨一點，直到咬起來平均舒服，再拋光。
                17. **衛教與回診**：教你怎麼戴、怎麼洗、要戴多久、何時回來檢查。
                18. **術後追蹤**：之後定期回診，看咬合有沒有跑掉、咬合板有沒有裂掉；必要時調整或重做。
        3. 潛在可能可以優化的方向（這段真的是僅供參考，有待進一步確認、討論 和 研究）
            - 進入切片軟體前
                
                
                | 可優化的項目 | 痛點                                                                      | 量化或質化數據               | 競品主流軟體支援現況（可做到什麼／還差多少）                | 佐證資料與參考文獻    |
                | --- | --- | --- | --- | --- |
                | 設計參數與處方及設計時間  | 覆蓋範圍與厚度需依處方與適應症；處方臨床語言（如磨牙症、TMJ）須翻譯成具體參數，多靠經驗手動決定，出錯導致重做與回診。取像→咬合對位→設計本體與咬合面→匯出為固定成本，椅旁擠壓列印＋調整時間（目標 45 分–1 小時），技工所則為每日件數硬上限且需有經驗者，產能常被少數設計者綁住。設計約 12–20 分鐘；處方／適應症一鍵套用較少，多為手動輸入。  | 數位取像（口掃或取模）約 **5–10 分鐘**；咬合板／牙合墊設計（2-1～2-10）約 **12–20 分鐘**（時間估計依原廠 workflow 與文獻範例彙整，例如 Formlabs 與 SprintRay 咬合板設計教學，通常以「設計約十多分鐘」描述；本表取其中間區間作為實務參考值，實際時間視病例複雜度與操作者熟練度而異）。  | **競品現況**：Formlabs、SprintRay 有設計指引與厚度建議（如 1.5–3 mm）、示範咬合板設計步驟與大致時間；exocad、3Shape 等 CAD 可設覆蓋與厚度，並支援虛擬咬合器調整咬合。
                
                **還差**：處方／適應症一鍵套用（如磨牙症預設較厚或較硬）較少，多為手動輸入；且現有自動化功能多仍需有經驗者審核與微調，尚未達到「新人也能放心一鍵使用」的信任程度；設計流程雖已標準化，但仍仰賴人力逐步操作，尚缺進一步自動化以明顯縮短 12–20 分鐘設計時間。  | [Formlabs 咬合板／牙合墊應用指南](https://dental.formlabs.com/indications/splints-and-occlusal-guards/guide/)
                
                [SprintRay 咬合板 workflow](https://sprintray.com/learn-3d-printing-night-guard-workflow-cloud-design/) |
            - 切片軟體中
                
                
                | 可優化的項目 |  痛點                      |  量化或質化數據        |  競品主流軟體支援現況（可做到什麼／還差多少）                    |  佐證資料與參考文獻                |
                | --- | --- | --- | --- | --- |
                | 咬合板專用支撐策略    | 支撐不接觸咬合面與內面就位區，否則影響試戴就位與咬合紙調整。缺咬合板情境下咬合面／內面為支撐禁區的一鍵預設；多為通用支撐。                                            |  質化：支撐若接觸咬合面或內面會影響試戴與咬合紙調整。                                                                                      |  **競品現況**：支撐可手動編輯避開區域；Formlabs、SprintRay 有咬合板流程說明。**還差**：**咬合板情境**下咬合面／內面（就位區）為支撐禁區的一鍵預設；多為通用支撐。                                     | [Formlabs 咬合板／牙合墊應用指南](https://dental.formlabs.com/indications/splints-and-occlusal-guards/guide/)
                
                [SprintRay 咬合板 workflow](https://sprintray.com/learn-3d-printing-night-guard-workflow-cloud-design/) |
                | 多件排版與自動排列    | 技工所常需同一建構板上同時排版多個咬合板，手動排版易耗時且空間利用不佳；手動拖曳易過於保守浪費空間或過密導致拆件不便。椅旁多為單件較少此痛點，技工所批次製作時比例較高。缺減少反覆手動調整位置與角度的負擔。   | 質化：產業與原廠之 nesting 教學多示範「同一版排多件」以提升 throughput，並建議透過角度調整與適當間距來擴大單版件數；高密度 nesting 尤其常見於夜間批次列印情境。具體件數依機型與咬合板外型而異。  | **競品現況**：部分切片軟體提供一般牙科模型的自動排版與高密度 nesting 建議，亦可手動排版多件咬合板。
                
                **還差**：減少技工所批次排版時需反覆手動調整位置與角度的時間與操作負擔。                                      | [ifun3d 牙科排版 nesting](https://ifun3d.com/blog/3d-printing/dental/dental-3d-printing-nesting-strategies)
                
                Formlabs、SprintRay 咬合板／夜間牙套 workflow（多件排版）                               |
                | 咬合板標籤／壓字與辨識  | 需能清楚分辨不同病人與左右側／上下顎，避免混件。外觀多為透明、形狀相似，僅依肉眼與收納位置易拿錯；標記需兼顧辨識與配戴舒適，內面與咬合面通常不壓字。缺咬合板情境下一鍵套用標籤模板與檢查每件是否具備清楚標識。  | 質化：實務上部分單位會在咬合板外側或非就位面（如頰側外牆）做浮雕文字標記患者或左右側，或僅在收納盒與標籤標示病人；內面與咬合面通常不壓字，以免影響接觸面與配戴舒適。            | **競品現況**：在 CAD 設計階段或切片軟體（具 Tagging 功能者）中，使用者可手動新增文字幾何作為標記。
                
                **還差**：咬合板情境下，一鍵套用標籤模板（如自工單帶入患者姓名／代碼與左右側資訊、預設壓在外側安全區），以及檢查每件咬合板是否具備清楚標識。  | Formlabs、SprintRay 咬合板 workflow（建議明確標示病例與側別）
                
                Chitubox Dental Tagging（Add text labels to models） |
            - 切片軟體後
                
                
                | 可優化的項目 | 痛點                                                                                                                             | 量化或質化數據                              | 競品主流軟體支援現況（可做到什麼／還差多少）                                                    | 佐證資料與參考文獻                       |
                | --- | --- | --- | --- | --- |
                | 材料強度與耐久性   | 口內長期配戴，材料選擇影響安全與耐用。磨牙症咬合力大，列印樹脂易磨耗、裂紋或斷裂，重做頻率偏高；缺乏依適應症／負荷選擇材料的明確指引；列印較銑削強度與耐久性常略遜，長期追蹤數據較少，醫師與患者對耐用度信心不足；破裂後需重取模、重做。軟體端無耐久性預測。  | 質化：3D 列印較銑削強度與耐久性常略遜；磨牙症負荷大。         | **競品現況**：原廠提供樹脂認證與使用說明；Sage 等文獻回顧材料比較。
                
                **還差**：屬材料與臨床研究，非單一軟體可解決；軟體端無耐久性預測。  | **痛點佐證出處**（均出自 Sage 敘述性文獻回顧 van Lingen & Tribst, 2025）：磨牙症咬合力 450–650 N、材料須具優異機械性質見 Materials 節；列印咬合板彎曲強度與表面硬度多低於銑削／冷聚合 PMMA、銑削抗斷裂最高見 Comparison in Durability, Strength, and Biocompatibility；列印材料於口內行為與長期療效資料仍不足、需更多臨床驗證見 Abstract／Conclusion 與 "3D-printing or Milling?"；咬合板材料研究有限、選材指引不足見 "Research on materials... is limited" 與 Technical Challenges；磨耗與斷裂後重做為臨床常態，數位存檔可重印但仍耗時耗成本。 [Sage：3D 列印咬合板敘述性文獻回顧](https://journals.sagepub.com/doi/10.1177/23202068251317825) |
    - 臨時牙冠/牙橋
        1. 用途：在正式牙冠／牙橋還沒做好前，用來**暫時保護磨好的牙齒並維持功能與美觀**。
            
            ![截圖 2026-03-12 晚上11.37.00.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E6%99%9A%E4%B8%8A11.37.00.png)
            
        2. 工作流程
            - 流程圖 (以臨時牙冠說明)
                
                ![截圖 2026-03-12 晚上8.39.53.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/%E6%88%AA%E5%9C%96_2026-03-12_%E6%99%9A%E4%B8%8A8.39.53.png)
                
            - 步驟說明
                1. **術前口掃（可選）**：還沒磨牙前可先掃一次，給電腦做參考。
                2. **匯入術前掃描**：把術前掃描匯進軟體。
                3. **③ 建立臨時牙冠／牙橋**：在電腦裡做出臨時假牙的外型（依對側牙或牙齒設計庫）。
                4. **④ 備牙後口掃**：磨完牙再掃一次。
                5. **⑤ 匯入備牙後掃描**：把備牙後掃描載入、檢查網格。
                6. **⑥ 對齊術前與備牙後**：若有術前掃描，把術前與備牙後對齊在同一座標系。
                7. **⑦ 設定邊緣線**：標示 margin line（邊緣線）。
                8. **⑧ 內部適配**：調整內面與支台齒適配、黏著劑空間。
                9. **⑨ 鄰接面與咬合**：設定鄰接點、咬合關係、微調外形。
                10. **⑩ 檢查脫戴路徑**：確認單一脫戴路徑、無倒凹。
                11. **⑪ 匯出加工檔**：存成列印機或銑床讀得懂的檔案。
                12. **⑫ 選擇製造方式**：選「3D 列印」或「CNC 切削」。
                13. **⑬ 列印前處理 orientation、支撐、切片**：**選 3D 列印時**，定好方向、加好支撐、切片。
                14. **⑭ 銑削設定**：**選 CNC 切削時**，在電腦裡設定銑削路徑。
                15. **⑮ 列印臨時牙冠樹脂**：選 3D 列印就把臨時冠印出來。
                16. **⑯ 清洗、固化、去支撐**：列印後洗乾淨、固化、把支撐拆掉。
                17. **⑰ 切削、自夾具分離**：選 CNC 切削就切削出來，然後把作品從樹脂塊/夾具分離。
                18. **⑱ 打磨拋光**：不管列印或切削，最後都要打磨拋光讓邊緣與表面更順。
                19. **⑲ 臨床臨時黏著**：醫生把臨時假牙用暫時膠黏在病人牙齒上，等正式假牙做好再換。
                20. **⑳ 術後追蹤 臨時戴用期間回診 → 最終取模／口掃 → 戴正式牙冠／牙橋並衛教**：臨時戴用期間回診檢查；正式假牙完成後取模/口掃與戴牙，並衛教追蹤。
        3. 潛在可能可以優化的方向（這段真的是僅供參考，有待進一步確認、討論 和 研究）
            - 切片軟體中
                
                
                | 可優化的項目 |  痛點                 | 量化或質化數據                              | 競品主流軟體支援現況（可做到什麼／還差多少）                                                                                                                               | 佐證資料與參考文獻                                                                                                                                                                                                                           |
                | --- | --- | --- | --- | --- |
                | 支撐避開咬合面與鄰接面    | 支撐若長在咬合面或鄰接面，去支撐後會影響咬合接觸與鄰牙接觸，試戴時需大量打磨，拖長椅旁時間。缺臨時冠情境下咬合面／鄰接面為支撐禁區的一鍵預設。                                            | 質化：以利試戴與鄰牙接觸；去支撐後打磨拋光再交付臨床。                                                                 | **競品現況**：Chitubox、PreForm 等可手動編輯支撐避開區域。
                
                **還差**：**臨時冠情境**下咬合面／鄰接面為支撐禁區的一鍵預設；多為通用支撐。                                                                     | [Frontiers in Oral Health](https://www.frontiersin.org/journals/oral-health/articles/10.3389/froh.2024.1491984/full)
                
                [BMC Oral Health](https://bmcoralhealth.biomedcentral.com/articles/10.1186/s12903-025-07154-0) |
                | 送印急件標記與預估完成時間  | 椅旁目標 45 分–1 小時內戴入，送印需優先排程，診間需知道「何時可試戴」。單顆列印約 10 分鐘。切片軟體多無急件標記，缺送印後預估完成時間與排程儀表板。                                    | 單顆列印可約 **10 分鐘**；椅旁目標 **45 分–1 小時**內戴入。                                                     | **競品現況**：列印機可顯示預計時間；切片軟體多無急件標記。
                
                **還差**：**急件標記**與送印後**預估完成時間**（何時可試戴）；排程與儀表板較少。                                                                         | [SprintRay](https://sprintray.com/) |
                | 臨時冠／牙橋標記與辨識    | 需清楚分辨不同病人與牙位的臨時冠／牙橋以避免混件。多顆外觀相似且體積小，僅靠托盤或肉眼易拿錯；牙冠本體不壓字以兼顧外觀與邊緣密合，實務多在工單、托盤、小盒或貼紙標示。缺一鍵生成對應工單的標籤資訊與切片檔／列印批次名稱自動對應。  | 質化：實務上多不在樹脂牙冠本體壓字，而是在工單、托盤、裝牙冠的小盒／袋或貼紙上標示患者與牙位（如「#46 temp crown」），以避免混件；牙冠本體維持無文字以兼顧外觀與適配。  | **競品現況**：設計與切片軟體多未直接處理外部標記，但可透過與訂單／工單系統整合，在匯出檔名與列印批次名稱中帶入患者與牙位資訊，協助對應實體標籤。
                
                **還差**：臨時冠情境下，一鍵生成對應工單的標籤資訊（如托盤／盒子標籤列印或 QR code），與切片檔／列印批次名稱自動對應，減少人工對照出錯。  | [Capitol Dental 椅旁臨時冠 workflow](https://capitoldental.com/3d-printing-dental-temporary-crowns/)；
                
                [ifun3d 臨時牙冠製作流程](https://ifun3d.com/blog/3d-printing/dental/temporary-crown-fabrication-using-dental-3d-printers)
                
                臨床常規工單與托盤標記實務經驗 |
- 特定議題
    - 壓字實務整理表
        
        
        | **應用** | **是否實務上常壓字？** | **壓在哪裡？** | **主要用途／考量** | **常見壓字格式例** |
        | --- | --- | --- | --- | --- |
        | **正畸模型（隱形牙套用模型）** | **很常壓字** | 多在模型的**底座**（馬蹄形或平台狀底盤），有時在底座**側緣或背面** | 底座面積大又平整，不影響牙弓與熱壓接觸面；方便取件、熱壓、出貨時從實物辨識階段與病人 | `2025-0305-Wang-01`、`PT12345_S01`、`WDM-01` |
        | **手術導板** | **建議都要有標籤／文字** | 導板**外側、不接觸牙齒／黏膜的一面**（如頰側外牆、不影響就位的平面，做浮雕文字） | 手術室快速辨識患者與牙位／側別，避免錯病人或錯側使用 | `王大明 #46 R`、`PT12345 36 L`、`A2025-0305 36-37 右` |
        | **咬合板／牙合墊** | **有時壓字、有時只在盒子／標籤寫名字** | 若壓字，多在**外側或非就位面**（如頰側外牆），不在內面／咬合面 | 兼顧辨識與配戴舒適；避免影響口內接觸面與咬合 | 依單位自訂（多為患者姓名／代碼＋左右側），也常僅在收納盒或標籤標示 |
        | **臨時牙冠牙橋** | **幾乎不在牙冠本體上壓字** | 不壓在牙冠本體；改在**工單、托盤、小盒或袋子**上標示患者與牙位 | 牙冠很小且需良好外觀與邊緣密合，不適合加文字；以外部標示避免混件 | 盒／托盤標示如：`#46 temp crown`、患者姓名＋牙位等（牙冠本體維持無文字） |
- 參考資料與文獻彙整（依原文件引用，直接連結）
    
    本表所列參考資料均來自**《四種牙科應用模式_流程圖》**內文所引用之連結與文獻名稱；**所有項目均已補上可直接點擊之連結**（學術論文為期刊原文或 PMC／出版社 URL）。
    
    |  類型     |  名稱／說明 |  直接連結 |  用途（本文件對應階段） |
    | --- | --- | --- | --- |
    |  產業／原廠  | Align3D（347 家牙科診所分析）                               | https://align3d.io/why-digital-workflows-fail-and-how-to-fix-them-in-30-days/ | 正畸：流程失敗率                          |
    |  產業／原廠  | Luxcreo（同日流程）                                      | https://luxcreo.com/how-to-use-a-dental-3d-printer-complete-digital-workflow-from-scan-to-same-day-delivery/ | 正畸：作業時間、列印與後處理                    |
    |  產業／原廠  | QuiteClear                                         | https://quiteclear.io/improving-lead-times-in-clear-aligner-production-what-orthodontic-practices-need-to-know/ | 正畸：交期與溝通、製造瓶頸                     |
    |  產業／原廠  | ClearMoves                                         | https://clearmovesaligners.com/digital-workflows-and-3d-printing-in-aligner-production/ | 正畸：外包交期、批次列印                      |
    |  學術／審閱  | ScienceDirect 審閱（2025）AI in clear aligner therapy  | https://www.sciencedirect.com/science/article/pii/S0300571225000107 | 正畸：牙齒分割、對位、staging                |
    |  學術     | JOCPD（2023）、BMC Oral Health（2025）                  | [JOCPD](https://www.jocpd.com/articles/10.22514/jocpd.2023.038)
    [BMC](https://bmcoralhealth.biomedcentral.com/articles/10.1186/s12903-025-07405-0) | 正畸：病患遵從                           |
    |  產業／原廠  | Orthodontic Products（Align 批次列印）                   | https://orthodonticproductsonline.com/treatment-products/aligners/inside-align-technols-million-custom-appliances-a-day-3d-printing-operation/ | 正畸：列印時機、一次印出全部階段                  |
    |  軟體     | Chitubox Dental                                    | https://support.dental.chitubox.com/en-US/user-manual/latest/ui-and-features/operations |  正畸／切片：列印前處理、排版                    |
    |  軟體     | ifun3d 牙科排版 nesting                                | https://ifun3d.com/blog/3d-printing/dental/dental-3d-printing-nesting-strategies |  正畸：多件排版                           |
    |  軟體     | 3Shape Clear Aligner Studio                        | https://support.3shape.com/products-ortho-system-how-to/3shape-clear-aligner-studio-workflow-on-ortho-system |  正畸：Base、staging、STL 匯出            |
    |  軟體     | uLab uDesign Cloud                                 | https://www.ulabsystems.com/ulab-systems-launches-udesign-cloud-2-0-bringing-segmentation-self-planning-and-cloud-based-printing-together-in-one-flexible-aligner-platform/ |  正畸：segmentation、setup、STL export  |
    |  軟體     | InvisAlign Outcome Simulator 隱適美牙套模具生成流程模擬軟體（v4.2 使用手冊）  | https://videos.iteroed.com/APAPP001zhTW_UserGuideInvisalignOutcomeSimulatorv4_2.pdf |  正畸：模擬、模具生成流程  |
    |  軟體     | OrthoAnalysis 軟體操作流程（使用手冊 v3.1）        | https://www.inteware.com.tw/wp-content/uploads/2020/09/OrthoAnalysis_%E8%BB%9F%E9%AB%94%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C-v3.1_20508.pdf |  正畸：分析與操作流程  |
    |  軟體     | iTero Element 口內掃描機軟體（含隱適美操作）Restorative Guidebook  | https://storagy-itero-production-eu.s3.amazonaws.com/download/iTero-Element-Restorative-Guidebook-Traditional-Chinese.pdf |  正畸：口掃、隱適美整合  |
    |  產業／教育  | 隱形矯正附著體（Attachment）說明（UR Smile）        | https://www.ur-smile.com.tw/news/5049/#:~:text=%E4%BB%80%E9%BA%BC%E6%98%AF%E9%9A%B1%E5%BD%A2%E7%9F%AF%E6%AD%A3%E7%9A%84%E9%99%84%E4%BB%B6%EF%BC%88Attachment%EF%BC%89%EF%BC%9F%20*%20%E5%A4%96%E8%A7%80%EF%BC%9A%E5%B0%8F%E5%B0%8F%E4%B8%80%E9%A1%86%EF%BC%8C%E9%A1%8F%E8%89%B2%E6%8E%A5%E8%BF%91%E7%89%99%E9%BD%92%E6%9C%AC%E8%BA%AB%EF%BC%8C%E9%81%A0%E7%9C%8B%E5%B9%BE%E4%B9%8E%E7%9C%8B%E4%B8%8D%E8%A6%8B%E3%80%82%20*%20%E4%BD%8D%E7%BD%AE%EF%BC%9A%E4%BE%9D%E7%85%A7%E7%9F%AF%E6%AD%A3%E8%A8%88%E7%95%AB%EF%BC%8C%E5%8F%AF%E8%83%BD%E8%B2%BC%E5%9C%A8%E5%89%8D%E7%89%99%E3%80%81%E7%8A%AC%E9%BD%92%E6%88%96%E5%BE%8C%E7%89%99%E3%80%82%20*%20%E5%8A%9F%E8%83%BD%EF%BC%9A%E5%B9%AB%E5%8A%A9%E9%9A%B1%E5%BD%A2%E7%89%99%E5%A5%97%E6%9B%B4%E7%89%A2%E5%9B%BA%E5%9C%B0%E6%8A%93%E4%BD%8F%E7%89%99%E9%BD%92%EF%BC%8C%E6%96%BD%E5%8A%A0%E9%81%A9%E7%95%B6%E5%8A%9B%E9%87%8F%EF%BC%8C%E5%BC%95%E5%B0%8E%E7%89%99%E9%BD%92%E6%9C%9D%E6%AD%A3%E7%A2%BA%E6%96%B9%E5%90%91%E7%A7%BB%E5%8B%95%E3%80%82 |  正畸：附著體功能、位置與外觀  |
    |  影音／教學  | 正畸／隱形矯正相關教學（YouTube）                   | https://www.youtube.com/watch?v=nuJV06s-Zqg
    
    https://www.youtube.com/watch?v=DWHz4d6sjEs
    
    https://www.youtube.com/shorts/gm7nG9Hkpi4 | 正畸：流程示範與操作教學  |
    |  影音／教學  | 手術導板相關教學（YouTube） | https://www.youtube.com/watch?v=tWrGo_eih2U
    
    https://www.youtube.com/watch?v=n05M7LPBSRQ | 手術導板：流程示範與操作教學  |
    |  產業／原廠  | SprintRay Guide to 3D Printing Surgical Guide      | https://sprintray.com/guide-to-3d-printing-surgical-guide/ | 手術導板：流程、支撐、生醫樹脂、列印與後處理            |
    |  產業／原廠  | 3Shape Implant Studio                              | https://www.3shape.com/en/software/implant-studio | 手術導板：規劃、對位、列印整合                   |
    |  產業／原廠  | 3Shape Support: Implant Studio & Implant Planner   | https://support.3shape.com/implant-studio-implant-planner | 手術導板：對位與規劃                        |
    |  產業／原廠  | 3Shape：整合列印／銑削至 Implant Studio                     | https://support.3shape.com/lab-implant-studio-and-implant-planner-how-to/how-to-integrate-3d-printers-or-milling-machines-into-implant-studio-for-surgical-guide-production | 手術導板：導板列印、公差                      |
    |  學術     | MDPI Materials 16(15)5305（滅菌對手術導板之影響）              | [MDPI](https://www.mdpi.com/1996-1944/16/15/5305)
    [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10419648/) | 手術導板：滅菌對精度與適配                     |
    |  學術     |  Frontiers：半導與全導手術導板精度比較                            | https://www.frontiersin.org/articles/10.3389/fdmed.2025.1700363 | 手術導板：半導式與全導式精度差異                  |
    |  影音／教學  | 咬合版相關教學（YouTube） | https://www.youtube.com/watch?v=3cUXPDHJq9w | 咬合板：流程示範與操作教學  |
    |  學術     | PMC：樹脂類型、層厚與列印方向對咬合板機械與表面性質                        | https://pmc.ncbi.nlm.nih.gov/articles/PMC12845963/ | 咬合板：列印方向對適配與強度                    |
    |  學術     | Formlabs：列印方向對咬合板適配之影響                             | https://dental.formlabs.com/blog/3d-printed-occlusal-splints-impact-of-printing-orientation/ | 咬合板：列印方向建議                        |
    |  學術     | Clin Labor Res Dent (USP)                          | https://www.revistas.usp.br/clrd/ | 咬合板：列印方向與適配                       |
    |  學術     | Sage（van Lingen & Tribst, 2025）：3D 列印咬合板敘述性文獻回顧    | https://journals.sagepub.com/doi/10.1177/23202068251317825 | 咬合板：材料強度、磨牙症、生物相容性                |
    |  學術     | Romanian J Oral Rehabilitation（咬合板與磨牙症）            | https://rjor.ro/wp-content/uploads/2024/04/APPLICATIONS-OF-3D-PRINTING-TECHNIQUES-FOR-OCCLUSAL-SPLINTS-USED-IN-BRUXISM-1.pdf | 咬合板：設計與列印時間、磨牙症                   |
    |  產業／原廠  | Formlabs 咬合板／牙合墊應用指南                               | https://dental.formlabs.com/indications/splints-and-occlusal-guards/guide/ | 咬合板：設計時間、支撐、列印                    |
    |  產業／原廠  | SprintRay 咬合板／night guard、workflow                 | [咬合板](https://sprintray.com/digital-dentistry/occlusal-guards-and-splints/)
    [workflow](https://sprintray.com/learn-3d-printing-night-guard-workflow-cloud-design/) | 咬合板：設計與列印時間                       |
    |  學術     | BMC Oral Health：口掃與樹脂對 3D 列印冠適配之影響                 | https://bmcoralhealth.biomedcentral.com/articles/10.1186/s12903-025-07154-0 | 臨時牙冠：口掃–樹脂組合、gap 0.06–0.12 mm     |
    |  學術     | Frontiers in Oral Health：列印參數對臨時修復體適配              | https://www.frontiersin.org/journals/oral-health/articles/10.3389/froh.2024.1491984/full | 臨時牙冠：邊緣與內部適配、支撐                   |
    |  學術     |  Scientific Reports / PMC：3D 列印臨時冠回顧研究              | https://pmc.ncbi.nlm.nih.gov/articles/PMC11283549/ | 臨時牙冠：邊緣適配、臨床表現                    |
    |  產業／原廠  |  Capitol Dental 椅旁 3D 列印臨時冠                         | https://capitoldental.com/3d-printing-dental-temporary-crowns/ | 臨時牙冠：椅旁流程、掃描至戴入時間                 |
    |  產業／原廠  |  ifun3d 臨時牙冠製作                                      | https://ifun3d.com/blog/3d-printing/dental/temporary-crown-fabrication-using-dental-3d-printers | 臨時牙冠：椅旁流程、樹脂與後處理                  |
    |  產業／原廠  |  DDS News 椅旁 workflow                               | https://news.digital-dentistry.org/report/chairside-workflows-in-modern-dentistry-indirect-resin-composite-restorations-with-advanced-3d-printing-technology/ | 臨時牙冠：椅旁同日流程                       |
    |  產業／原廠  |  SprintRay 首頁（椅旁、列印時間等）                             | https://sprintray.com/ | 臨時牙冠：椅旁急件、列印時間                    |
- 流程圖節點中英對照
    
    
    |  中文                          |  English                                                        |
    | --- | --- |
    |  口腔掃描                        |  Intraoral Scanning                                             |
    |  口腔表面掃描 IOS                 |  Intraoral Surface Scan (IOS)                                  |
    |  IOS（口內掃描）                 |  IntraOral Scanner（口內掃描機／掃描結果；非 Apple iOS）    |
    |  CBCT 骨骼掃描                   |  CBCT Scan（Cone Beam CT）                                     |
    |  建立數位模型                      |  Digital Model Creation                                         |
    |  牙齒分割                        |  Tooth Segmentation                                             |
    |  排牙設計                        |  Digital Setup                                                  |
    |  附著體設計                       |  Attachment Design                                              |
    |  IPR 規劃                      |  IPR / Interproximal Reduction Planning                         |
    |  過矯正                         |  Overcorrection                                                 |
    |  階段模擬                        |  Staging                                                        |
    |  生成各階段模型                     |  Generate Staged Models                                         |
    |  基座與標籤                       |  Add Base & Labels                                              |
    |  醫師確認                        |  Clinician Approval                                             |
    |  與病患確認治療計畫與效果         |  Confirm Treatment Plan with Patient                           |
    |  匯出 STL/OBJ                |  Export 3D Files                                                |
    |  列印前處理                      |  Print Preparation                                              |
    |  方向                           |  Orientation                                                    |
    |  Base                        |  Base（Model Base）                                            |
    |  內部填充                        |  Infill / Internal Filling                                      |
    |  排版                           |  Layout / Nesting                                               |
    |  切片                           |  Slicing                                                        |
    |  3D 列印                        |  3D Printing                                                    |
    |  清洗與二次固化                     |  Wash & Cure                                                    |
    |  熱壓成型隱形牙套                    |  Thermoforming Clear Aligners                                   |
    |  進度追蹤                        |  Treatment Progress Tracking                                    |
    |  匯入 IOS STL                 |  Import IOS STL                                                 |
    |  匯入 CBCT DICOM              |  Import CBCT DICOM                                              |
    |  初步對位                        |  Initial Alignment                                              |
    |  精細配準                        |  Fine Registration                                              |
    |  確認對位品質                      |  Verify Registration Quality                                    |
    |  標記解剖禁區                      |  Mark Anatomical No-go Zones                                    |
    |  選擇植體系統與尺寸                   |  Select Implant System & Size                                   |
    |  規劃植體位置                      |  Plan Implant Position                                          |
    |  規劃植體角度與深度                  |  Plan Implant Angulation & Depth                                |
    |  虛擬修復體                       |  Virtual Prosthesis（Prosthetic-driven Planning）              |
    |  設計導板本體（觀景窗可選）     |  Design Surgical Guide Body (Window Optional)                   |
    |  放置金屬套環孔位                    |  Place Metal Sleeve Holes                                       |
    |  檢查導板就位                      |  Check Guide Fit                                                |
    |  匯出導板 3D 檔                   |  Export Guide 3D Model                                          |
    |  orientation、支撐、切片          |  Orientation, Supports & Slicing                                |
    |  生醫級導板樹脂列印                   |  3D Print Biocompatible Surgical Guide Resin                   |
    |  置入金屬定位環                     |  Insert Metal Sleeves                                           |
    |  高壓滅菌後手術使用                   |  Autoclave & Surgical Use                                       |
    |  咬合板／牙合墊設計                   |  Occlusal Splint / Bite Plane Design                            |
    |  匯入上顎／下顎掃描檔                |  Import Maxillary / Mandibular Scans                            |
    |  識別牙弓與咬合                     |  Identify Arch & Occlusion                                      |
    |  虛擬咬合器／咬合對位               |  Virtual Articulator / Occlusal Alignment                       |
    |  決定覆蓋範圍與厚度                   |  Define Coverage & Thickness                                    |
    |  設計咬合板本體（罩蓋）             |  Design Splint Shell                                            |
    |  咬合面成形                       |  Occlusal Surface Design                                        |
    |  邊緣修整                        |  Edge Trimming                                                  |
    |  檢查厚度                        |  Thickness Check                                                |
    |  可選：內部紋理或通氣                |  Optional Internal Texture / Venting                            |
    |  3D 列印透明樹脂                    |  3D Print Clear Resin                                           |
    |  試戴、咬合紙調整、拋光             |  Try-in, Occlusal Adjustment, Polishing                         |
    |  衛教與回診                       |  Patient Instructions & Recall                                  |
    |  術前口掃（可選）                   |  Optional Pre-op Scan                                           |
    |  匯入術前掃描                      |  Import Pre-op Scan                                             |
    |  備牙後口掃                       |  Post-preparation Scan                                          |
    |  匯入備牙後掃描                     |  Import Post-prep Scan                                          |
    |  對齊術前與備牙後                    |  Align Pre-op & Post-prep Scans                                 |
    |  設定邊緣線                       |  Define Margin Line                                             |
    |  內部適配（內部適配度調整）     |  Internal Adaptation                                            |
    |  鄰接面與咬合                      |  Proximal Contacts & Occlusion                                  |
    |  檢查脫戴路徑                      |  Check Path of Insertion                                        |
    |  匯出加工檔                       |  Export Manufacturing Data                                      |
    |  選擇製造方式                      |  Choose Manufacturing Method                                    |
    |  銑削設定                        |  Milling Setup                                                  |
    |  列印臨時冠樹脂                     |  3D Print Temporary Crown Resin                                 |
    |  清洗、固化、去支撐                   |  Wash, Cure & Remove Supports                                   |
    |  切削、自夾具分離                    |  Mill & Detach from Block                                       |
    |  打磨拋光                        |  Finishing & Polishing                                          |
    |  臨床臨時黏著                      |  Clinical Temporary Cementation                                 |
    |  術後追蹤（臨時戴用～正式戴牙）            |  Post-op Follow-up（Temp Phase to Final Prosthesis Delivery）  |
- **光固化流程、背景知識 與 參數說明**
    
    ![ChatGPT Image 2026年5月15日 下午01_24_33.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/ChatGPT_Image_2026%E5%B9%B45%E6%9C%8815%E6%97%A5_%E4%B8%8B%E5%8D%8801_24_33.png)
    
    ![ChatGPT Image 2026年5月15日 上午11_44_49.png](%E7%89%99%E7%A7%91%E6%95%B8%E4%BD%8D%E6%B5%81%E7%A8%8B%20(User%20Scenario)%20%E6%9A%A8%E5%85%89%E5%9B%BA%E5%8C%96%E8%B3%87%E8%A8%8A%20Domain%20Knowledge/ChatGPT_Image_2026%E5%B9%B45%E6%9C%8815%E6%97%A5_%E4%B8%8A%E5%8D%8811_44_49.png)
    
    # 光固化上拉式（Bottom-Up）列印完整流程
    
    > **適用機型**：LCD / DLP / MSLA 桌上型光固化（光源在樹脂槽**下方**，成型平台在槽內**向上**生長）
    > 
    > 
    > **術語對照**：上拉式 = Bottom-Up（光從底部往上）
    > 
    
    ---
    
    ## 一、與上拉式的特性
    
    | 項目 | 上拉式 Bottom-Up |
    | --- | --- |
    | 光源位置 | 樹脂槽**底部**（LCD / DLP） |
    | 平台移動主方向 | 每層完成後**向上**抬升剝離，再下降回程 |
    | 離型膜（FEP 等） | **有**，剝離力是核心課題 |
    | 額外機構 | 無刮刀（靠抬升讓樹脂回流） |
    | 廠牌 | Elegoo、Anycubic、Phrozen 等消費級機種 |
    
    ---
    
    ## 二、機台結構與名詞
    
    ```
            [ Z 軸馬達 ]
                  │
            ┌─────┴─────┐
            │  成型平台   │  ← 已固化模型黏在此，逐層往上長
            └─────┬─────┘
                  ▼
       ░░░░ 液態樹脂 ░░░░
      ┌───────────────────┐
      │   透明離型膜 FEP   │  ← 剝離受力點；需定期更換
      ├───────────────────┤
      │   LCD 遮罩螢幕     │  ← X/Y Resolution、抗鋸齒像素
      └───────────────────┘
            ▲ ▲ ▲ ▲
         UV 光源 (405 nm 等)  ← LigthPwm / BottomLigthPwm
    ```
    
    | 基礎名詞 | 英文 / 參數 | 說明 |
    | --- | --- | --- |
    | 層厚 | `LayerThickness` | 單層 Z 向高度，常見 0.025～0.1 mm |
    | 離型 / 剝離 | Peel | 固化層與 FEP 分離；抬升速度過快易拉斷 |
    | 抬升 | Lift | 平台向上，拉開模型與底膜 |
    | 回程 | Retract | 平台下降回下一層定位高度 |
    | 滅燈延遲 | `TurnOffTime` / Light-Off Delay | **舊版**：上一層熄燈到下一層點燈的**總時間**（含運動） |
    | 靜止時間 | Rest Time / `*_static_time` | **新版**：曝光前後分段等待，較直覺 |
    | 二段式速度 | Lift/Retract 1st & 2nd | 剝離慢、空程快；下降快、接觸慢 |
    
    ---
    
    ## 三、從切層到列印：五個生命週期階段
    
    ### 階段 0：切層與檔案打包（尚未開始列印）
    
    | 參數 | 說明 |
    | --- | --- |
    | `version` | 切層檔格式版本（如 V3.0） |
    | `software` / `software version` | 產生檔案的切片軟體與版本 |
    | `time` | 檔案建立／修改時間 |
    | `printer name` / `printer type` | 目標機型名稱與硬體類型 |
    | `profile name` | 樹脂參數檔名稱 |
    | `Anti-aliasing level` / `Grey level` / `Blur level` | 抗鋸齒、灰階、模糊；平滑像素階梯 |
    | `Grayscale_level` | 0：4bit；1：8bit 灰階模式 |
    | `XResolution` / `YResolution` | 螢幕像素解析度 |
    | `PlatformX/Y/ZLength` | 可列印範圍 (mm) |
    | `LayerThickness` | 層厚 (mm) |
    | `TotalLayers` | 總層數 |
    | `LayerContent_position_offset` | 各層影像資料在檔案中的偏移 |
    | `PreviewImage_116*116` / `PreviewImage_290*290` | 小／大預覽圖 |
    | `TotalVolume` / `TotalWeight` / `TotalPrice` / `PriceUnit` | 材料估算 |
    | `PrintTimes` | 預估總列印時間 (s) |
    | `Xmirror` / `Ymirror` | 多寫入檔案；**多數機台不讀**，由影像本身決定 |
    
    ---
    
    ### 階段 1：底層模式（`BottomLayers` 層）
    
    目的：**讓模型牢固黏在成型平台上**，並溫和完成前幾次剝離。
    
    | 步驟 | 動作 | 主要參數 | 單位 |
    | --- | --- | --- | --- |
    | 1 曝光 | UV 透過 LCD 固化 | `BottomExposureTime`、`BottomLigthPwm` | s；PWM 0～255 |
    | 2 抬升前靜止 | 熄燈後等待，讓交聯反應穩定 | `Bottom_Before_lift_static_time` | **s** |
    | 3 二段式抬升 | ① 慢速剝離 ② 快速拉開 | `BottomLiftSpeed` + `BottomLiftDist`；`BottomLift_second_Speed` + `BottomLift_second_Dist` | mm/min；**mm** |
    | 4 抬升後靜止 | 最高點停留，離型膜回彈、樹脂回流 | `Bottom_After_lift_static_time` | **s** |
    | 5 二段式回程 | ① 快速下降 ② 減速慢壓到底 | `BottomRetractSpeed` + `BottomRetractDist`；`BottomRetract_second_Speed` + `BottomRetract_second_Dist` | mm/min；**mm** |
    | 6 回程後靜止 | 壓到層厚定位後等待流平（**最關鍵**） | `Bottom_After_retract_static_time` | **s** |
    
    重複至完成 `BottomLayers` 層。
    
    ---
    
    ### 階段 2：過渡層（`transition layers`）
    
    說明
    
    ---
    
    底層曝光長、移動慢，若直接切到一般層，層間應力突變易斷層。
    
    ---
    
    過渡層將曝光時間、抬升／回程速度等**線性漸變**至一般層設定。
    
    ---
    
    ---
    
    ### 階段 3：一般層循環（重複至 `TotalLayers`）
    
    以下為**單層**完整循環（對應流程圖 6 步驟）：
    
    ### 流程總覽（單層循環）
    
    ```
      ┌─────────────────────────────────────────────────────────┐
      │  ① 曝光 → ② 抬升前靜止 → ③ 二段式抬升 → ④ 抬升後靜止       │
      │       → ⑤ 二段式回程 → ⑥ 回程後靜止 → 回到 ①              │
      └─────────────────────────────────────────────────────────┘
    ```
    
    ---
    
    ### 步驟 ① 曝光階段（Exposure）
    
    | 項目 | 內容 |
    | --- | --- |
    | **動作** | LCD 顯示本層切片，UV 由下方照射，液態樹脂在 FEP 上方固化，並與平台或上一層黏合 |
    | **參數** | `ExposureTime`、`LigthPwm` |
    | **單位** | s；PWM 0～255 |
    | **進階** | 抗鋸齒灰階像素 → 邊緣半固化，表面較平滑 |
    
    ---
    
    ### 步驟 ② 抬升前靜止（Before Lift Static）
    
    | 項目 | 內容 |
    | --- | --- |
    | **時間點** | 本層曝光結束、**UV 熄滅後**，平台尚未上移 |
    | **參數** | `Before_lift_static_time` |
    | **單位** | **秒 (s)**（非「分鐘」） |
    | **目的** | 讓交聯反應完成，剛固化層由「膠狀」轉為足夠強度 |
    | **效果** | 減少立刻拉扯造成的細節斷裂、支撐拉斷。讓光固化樹脂的**交聯反應持續進行**，使剛固化層由脆弱凝膠狀轉為**足以承受剝離的機械強度** |
    | **典型範圍** | 一般層 0～2 s；底層可較長 |
    
    ---
    
    ### 步驟 ③ 二段式抬升（Lift — Peel）
    
    | 項目 | 內容 |
    | --- | --- |
    | **動作** | 平台向上，將本層從 FEP **剝離**，並在下方留出樹脂回流空間 |
    | **為何要「大距離」抬升** | 僅移動一個層厚無法克服真空吸附；需數 mm 才能完整剝離 |
    | **第一段（慢）** | `LiftSpeed` × `LiftDist` — 剝離期，離型膜帳篷效應、由外而內分離 |
    | **第二段（快）** | `Lift_second_Speed` × `Lift_second_Dist` — 已脫膜後空程加速 |
    | **單位** | 速度 **mm/min**；距離 **mm** |
    | **風險** | 過快／過高 → 拉裂、掉底；過低 → 剝離不完全、耗時 |
    
    **離型膜剝離機制（簡述）**
    
    1. 平台上升 → FEP 被吸起呈帳篷狀
    2. 由邊緣向中心剝離（常伴隨輕微「啪」聲）
    3. 分離後 FEP 彈回貼合槽底
    
    ---
    
    ### 步驟 ④ 抬升後靜止（After Lift Static）
    
    | 項目 | 內容 |
    | --- | --- |
    | **時間點** | 平台到達抬升最高點，尚未開始下降 |
    | **參數** | `After_lift_static_time` |
    | **目的** | 讓離型膜彈性回復、減少震盪；讓樹脂有時間向下流動，
    讓黏在模型上的樹脂慢慢滴回去槽裡，避免樹脂亂噴或產生氣泡 |
    | **效果** | 避免膜仍在晃動時就高速壓回，延長 FEP 壽命、減少對撞 |
    
    ---
    
    ### 步驟 ⑤ 二段式回程（Retract）
    
    | 項目 | 內容 |
    | --- | --- |
    | **動作** | 平台下降，回到「上一層頂面 + 一個 `LayerThickness`」的列印高度 |
    | **第一段（快）** | `RetractSpeed` × `RetractDist` — 空中／遠離液面段，阻力小 |
    | **第二段（慢）** | `Retract_second_Speed` × `Retract_second_Dist` — 接近 FEP 的最後 1～2 mm，**慢壓** |
    | **目的** | 將多餘樹脂擠出狹縫，形成均勻的下一層液膜 |
    | **風險** | 末段過快 → 液壓衝擊、噴濺、氣泡、層移、細節撞歪 |
    
    ---
    
    ### 步驟 ⑥ 回程後靜止（After Retract Static）— 品質關鍵
    
    | 項目 | 內容 |
    | --- | --- |
    | **時間點** | 平台已壓到定位（與 FEP 間約一層厚），**尚未**開始下一層曝光 |
    | **參數** | `After_retract_static_time` |
    | **機台現象** | 壓到底後「頓一下」才亮藍光 — 即此等待 |
    | **目的** | ① 高黏度樹脂擠壓流平 
    ② 釋放液壓應力
    ③ 消除液面波紋 |
    | **效果** | 表面更細緻；過短易出現毛邊、水波紋、層厚偏大、細節糊掉 |
    | **與滅燈延遲關係** | 新版軟體中，此段即 **Rest Time Before Print** 的核心；舊版 `TurnOffTime` 須**大於等於**整段抬升＋回程＋此靜止的總時間 |
    
    ---
    
    ### 階段 4：列印結束
    
    | 動作 | 說明 |
    | --- | --- |
    | 最後一層完成循環 | 不再曝光 |
    | 平台上升至安全高度 | 通常接近 `PlatformZLength` 上限，方便取件 |
    
    ---
    
    ## 四、底層 vs 一般層參數對照表
    
    > 下列為**常見合理範圍**，實際請依樹脂、機台、環境與 FEP 類型微調。
    > 
    > 
    > **單位務必使用 s、mm/min、mm**，勿將靜止時間標成「分鐘」或把速度標成純「mm 距離」。
    > 
    
    | 流程階段 | 底層模式 | 一般層模式 | 標準單位 | 優化目的 |
    | --- | --- | --- | --- | --- |
    | 曝光時間 | `BottomExposureTime` 較長（例 25～60 s） | `ExposureTime` 較短（例 1.5～4 s） | **s** | 底層黏平台；一般層求速度與精度 |
    | 抬升前靜止 | `Bottom_Before_lift_static_time` | `Before_lift_static_time` | **s** | 固化強度、減少拉扯 |
    | 抬升 1 段 | `BottomLiftSpeed` 較慢 | `LiftSpeed` 中等 | **mm/min** | 溫和剝離 |
    | 抬升 1 段距離 | `BottomLiftDist` | `LiftDist` | **mm** | 剝離行程 |
    | 抬升 2 段 | `BottomLift_second_Speed` 較快 | `Lift_second_Speed` 較快 | **mm/min** | 空程省時 |
    | 抬升 2 段距離 | `BottomLift_second_Dist` | `Lift_second_Dist` | **mm** | 回流空間 |
    | 抬升後靜止 | `Bottom_After_lift_static_time` | `After_lift_static_time` | **s** | 膜回彈、樹脂流動 |
    | 回程 1 段 | `BottomRetractSpeed` 較快 | `RetractSpeed` 較快 | **mm/min** | 快速接近液面 |
    | 回程 1 段距離 | `BottomRetractDist` | `RetractDist` | **mm** |  |
    | 回程 2 段 | `BottomRetract_second_Speed` 較慢 | `Retract_second_Speed` 較慢 | **mm/min** | 慢壓防噴濺 |
    | 回程 2 段距離 | `BottomRetract_second_Dist` | `Retract_second_Dist` | **mm** | 精準定位層厚 |
    | 回程後靜止 | `Bottom_After_retract_static_time` 可較長 | `After_retract_static_time` 例 0.5～3 s | **s** | **滅燈延遲實質核心** |
    | 光源強度 | `BottomLigthPwm` | `LigthPwm` | 0～255 | 控制曝光能量與發熱 |
    
    **單層總時間（概念）**
    
    ```
    單層週期 ≈ 曝光
             + 抬升前靜止 + 抬升(1+2段) + 抬升後靜止
             + 回程(1+2段) + 回程後靜止
    ```
    
    ---
    
    ## 五、曝光延遲模式說明
    
    | 模式 | 參數 | 說明 |
    | --- | --- | --- |
    | 關燈時間 | `Exposure_delay_mode` → `TurnOffTime` | 從**熄燈**到**下一層點燈**的總秒數，**包含**平台運動時間 |
    | 靜止時間 | `Before_lift_static_time`、`After_lift_static_time`、`After_retract_static_time` | 各段分開設定 |
    
    **舊版 TurnOffTime 設定範例**
    
    - 若抬升＋回程共需 6.3 s，希望壓底後再靜止 2.7 s 才曝光
    - 則 `TurnOffTime` ≥ 6.3 + 2.7 = **9.0 s**
    - 若只填 2.7 s（小於運動時間），等待形同失效
    
    ---
    
    ## 六、進階切片參數（品質相關）
    
    | 參數 | 用途 | 實務建議 |
    | --- | --- | --- |
    | `Anti-aliasing level` / `Grey level` / `Blur level` | 邊緣灰階平滑，減少像素階梯 | 雕像、外觀件可開；精密孔位、齒輪可關或降低模糊 |
    | `LigthPwm` | UV 強度 | 過高易過曝、發熱；透明樹脂可略降並略增曝光時間 |
    | 收縮補償（軟體內，非機台檔必備） | 抵消固化收縮 1%～4% | 組裝件、孔軸配合必測 |
    | `Advance_Mode` | 0：一般；1：進階（依層定義） | 進階模式可逐層覆寫參數 |
    
    ---
    
    ## 七、三種靜止時間
    
    | 靜止 | 參數 | 主要解決的問題 |
    | --- | --- | --- |
    | 抬升前 | `Before_lift_static_time` | 剛固化層強度不足、一拉就斷 |
    | 抬升後 | `After_lift_static_time` | FEP 震盪、過早壓回損膜 |
    | 回程後 | `After_retract_static_time` | 樹脂未流平、水波紋、層厚不準、毛邊 |
    
    **調參方向（簡表）**
    
    | 現象 | 可優先嘗試 |
    | --- | --- |
    | 表面水波紋、大理石紋 | 增加 `After_retract_static_time` |
    | 細支撐易斷、掉底 | 增加 `Before_lift_static_time`；降低抬升 1 段速度 |
    | 離型膜易損、異響大 | 增加 `After_lift_static_time`；降低 `LiftDist`（在能完整剝離前提下） |
    | 列印太慢 | 縮短 2 段抬升／回程距離；適度提高 2 段速度（需驗證成功率） |
    
    ---
    
    ## 八、離型膜（FEP / PFA / ACF）簡表
    
    | 類型 | 特性 | 備註 |
    | --- | --- | --- |
    | FEP | 透光高、離型力相對弱、較硬 | 入門常見 |
    | PFA / nFEP | 更柔韌、剝離力較低 | 目前主流 |
    | ACF | 離型力強、可更快抬升 | 微霧面可能略影響極細節；成本高 |
    
    更換時機：嚴重霧化、凹陷不復原、頻繁黏底失敗、刺穿（需立即停機，避免樹脂漏到 LCD）。
    
    ---
    
    ## 九、內容訂正說明（相對常見錯誤說法）
    
    | 錯誤或混淆 | 正確說法 |
    | --- | --- |
    | 將「下沉式」描述為「上升脫離 FEP 再下降」 | 那是**上拉式**；下沉式為光在**上**、平台**下沉**、常配合刮刀 |
    | 靜止時間單位寫「分鐘」 | 應為**秒 (s)** |
    | 抬升速度單位只寫「mm」 | 速度為 **mm/min**（少數介面用 mm/s）；距離才用 **mm** |
    | 滅燈延遲 = 僅壓底後等待 | 舊版為**含運動**的總時間；新版拆成三段 Rest Time |
    | 曝光後立刻抬升最好 | 需**抬升前靜止**讓強度建立 |
    | 回程全程高速 | 末段必須**減速慢壓**，否則液壓與層移風險高 |
    | 上拉式與下沉式「光源都是由下往上」 | **僅上拉式**為下照；下沉式為**上照**液面 |
    
    ---
    
    ## 十、參考：完整參數清單索引
    
    點擊展開機台／檔案參數一覽
    
    | 參數名 | 中文 | 單位／備註 |
    | --- | --- | --- |
    | version | 版本 | 檔案格式 |
    | software / software version | 軟體／版本 |  |
    | time | 檔案時間 |  |
    | printer name / printer type | 印表機名稱／類型 |  |
    | profile name | 參數檔名稱 |  |
    | Anti-aliasing level | 抗鋸齒等級 |  |
    | Grey level | 灰階等級 |  |
    | Blur level | 模糊等級 |  |
    | PreviewImage_116*116 / 290*290 | 預覽圖 |  |
    | TotalLayers | 總層數 |  |
    | XResolution / YResolution | XY 解析度 | pixel |
    | Xmirror / Ymirror | 鏡像 | 多不讀 |
    | PlatformX/Y/ZLength | 平台尺寸 | mm |
    | LayerThickness | 層厚 | mm |
    | ExposureTime | 一般層曝光 | s |
    | Exposure_delay_mode | 延遲模式 | TurnOff 或 Rest |
    | TurnOffTime | 關燈時間 | s（含運動） |
    | Bottom_Before_lift_static_time | 底層抬升前靜止 | s |
    | Bottom_After_lift_static_time | 底層抬升後靜止 | s |
    | Bottom_After_retract_static_time | 底層回程後靜止 | s |
    | Before_lift_static_time | 抬升前靜止 | s |
    | After_lift_static_time | 抬升後靜止 | s |
    | After_retract_static_time | 回程後靜止 | s |
    | BottomExposureTime | 底層曝光 | s |
    | BottomLayers | 底層層數 | 層 |
    | BottomLiftDist / BottomLiftSpeed | 底層抬升 | mm；mm/min |
    | LiftDist / LiftSpeed | 一般層抬升 | mm；mm/min |
    | BottomRetractDist / BottomRetractSpeed | 底層回程 | mm；mm/min |
    | RetractDist / RetractSpeed | 一般層回程 | mm；mm/min |
    | BottomLift_second_Dist / Speed | 底層二段抬升 | mm；mm/min |
    | Lift_second_Dist / Speed | 一般層二段抬升 | mm；mm/min |
    | BottomRetract_second_Dist / Speed | 底層二段回程 | mm；mm/min |
    | Retract_second_Dist / Speed | 一般層二段回程 | mm；mm/min |
    | BottomLigthPwm / LigthPwm | 光源 PWM | 0～255 |
    | Advance_Mode | 進階模式 | 0/1 |
    | PrintTimes | 預估時間 | s |
    | TotalVolume / TotalWeight / TotalPrice / PriceUnit | 材料與成本 |  |
    | LayerContent_position_offset | 層資料偏移 | byte |
    | Grayscale_level | 灰階位元模式 | 0/1 |
    | transition layers | 過渡層數 | 層 |
    
    ---