import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ==========================================
// 1. LIVE MARKET INDICES (Via Finnhub API)
// ==========================================
export const getMarketIndices = async (req, res) => {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) throw new Error("Missing FINNHUB_API_KEY in .env file");

    // We use ETF proxies to get real-time global market data on the free tier
    // SPY = S&P 500 | EPI = Sensex Proxy | INDA = Nifty 50 Proxy | TLT = Treasury Bonds
    const symbols = [
      { ticker: 'SPY', name: 'S&P 500' },
      { ticker: 'EPI', name: 'Sensex (Proxy)' },
      { ticker: 'INDA', name: 'Nifty 50 (Proxy)' },
      { ticker: 'TLT', name: 'Govt Bonds' }
    ];

    const indices = await Promise.all(symbols.map(async (item) => {
      const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${item.ticker}&token=${apiKey}`);
      const data = response.data;
      
      // Finnhub Data Mapping: c = Current price, dp = Percent change
      const currentPrice = data.c || 0;
      const percentChange = data.dp || 0;
      const isUp = percentChange >= 0;
      
      // Generate a dynamic 6-point sparkline ending at the live current price
      const chart = [
        { v: currentPrice * (1 - (percentChange / 100) * 1.5) },
        { v: currentPrice * (1 - (percentChange / 100) * 1.2) },
        { v: currentPrice * (1 - (percentChange / 100) * 0.8) },
        { v: currentPrice * (1 - (percentChange / 100) * 0.4) },
        { v: currentPrice * (1 - (percentChange / 100) * 0.1) },
        { v: currentPrice }
      ];

      return {
        name: item.name,
        value: currentPrice,
        change: `${isUp ? '+' : ''}${percentChange.toFixed(2)}%`,
        isUp: isUp,
        chart: chart
      };
    }));

    res.status(200).json(indices);
  } catch (error) { 
    console.error("Market API Error:", error.message);
    // Graceful Fallback if API limit is reached
    res.status(200).json([
      { name: 'S&P 500', value: 5123.41, change: '+1.2%', isUp: true, chart: [{v: 4950}, {v: 4980}, {v: 4920}, {v: 5050}, {v: 5010}, {v: 5090}, {v: 5123}] },
      { name: 'Sensex', value: 73500.12, change: '-0.4%', isUp: false, chart: [{v: 74200}, {v: 74500}, {v: 74000}, {v: 74100}, {v: 73800}, {v: 73900}, {v: 73500}] },
      { name: 'Nifty 50', value: 22350.50, change: '+0.8%', isUp: true, chart: [{v: 21900}, {v: 22050}, {v: 21950}, {v: 22100}, {v: 22250}, {v: 22200}, {v: 22350}] },
      { name: 'Govt Bonds (10Y)', value: 7.12, change: '-0.05%', isUp: false, chart: [{v: 7.3}, {v: 7.25}, {v: 7.2}, {v: 7.15}, {v: 7.18}, {v: 7.14}, {v: 7.12}] }
    ]);
  }
};

// ==========================================
// 2. LIVE BUSINESS WIRE (With Shuffle Engine)
// ==========================================
export const getMarketNews = async (req, res) => {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) throw new Error("Missing FINNHUB_API_KEY in .env file");

    const response = await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`);
    
    // 1. Grab the massive array of today's articles (usually 50+)
    const allNews = response.data;

    // 2. The Shuffle Engine: Randomize the array and slice out 6 articles
    const shuffledNews = allNews.sort(() => 0.5 - Math.random()).slice(0, 6);
    
    // 3. Map Finnhub's JSON exactly to our UI's expected format
    const formattedNews = shuffledNews.map((item, index) => ({
      id: item.id || index, 
      title: item.headline,
      source: item.source,
      url: item.url
    }));

    res.status(200).json(formattedNews);
  } catch (error) { 
    console.error("News API Error:", error.message);
    res.status(200).json([
      { id: 1, title: "Live News Feed Offline - Check API Key or Rate Limits", source: "System", url: "#" }
    ]); 
  }
};

// ==========================================
// 3. LIVE AI MARKET DIAGNOSTIC (Gemini Engine)
// ==========================================
export const getMarketAIAnalysis = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY in .env file");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // UPGRADED PROMPT: Asking for a deeper, multi-layered analysis
    const prompt = `
      Act as a senior quantitative financial analyst for a premium wealth management dashboard. 
      Analyze the current global macroeconomic climate based on today's general market conditions.
      Provide a comprehensive 4-to-5 sentence macro summary. You must include a brief sector breakdown (what is overperforming/underperforming) and an actionable risk assessment. 
      Tone: Institutional, objective, highly analytical. 
      Formatting: Plain text only. 
      Limit to 4 lines only.[critical condition].
      
    `;

    const result = await model.generateContent(prompt);
    const aiSummary = result.response.text();

    res.status(200).json({ summary: aiSummary.trim() });
  } catch (error) { 
    console.error("AI Engine Error:", error.message);
    res.status(500).json({ 
      summary: "AI Diagnostic Engine currently offline. Awaiting API connection." 
    }); 
  }
};