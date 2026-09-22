const pdf = require("pdf-parse");
const OpenAI = require("openai");
const Campaign = require("../models/campaign.model");
const Character = require("../models/character.model");
const Message = require("../models/message.model");
const GameSession = require("../models/game-session.model");
const { GameContextManager, stateTools } = require("../services/game-context-manager");
const { findMentionedEntities } = require("../services/srd-lookup.service");

const AI_MODEL = process.env.OPENTYPHOON_MODEL || "typhoon-v2.5-30b-a3b-instruct";
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE || 0.85);
const DM_STOP_SEQUENCES = ["\nPLAYER:", "\nPlayer:", "\nผู้เล่น:", "\nYOU:"];
const typhoon = new OpenAI({
  apiKey: process.env.OPENTYPHOON_API_KEY,
  baseURL: process.env.OPENTYPHOON_BASE_URL || "https://api.opentyphoon.ai/v1",
});
const isMember = (campaign, userId) => campaign.members.some((member) => member.user.equals(userId));
const outlineInstructions = `Create a flexible long-form D&D campaign outline in Thai for the Dungeon Master. Build a complete story with an opening situation, 5 to 8 major chapters, escalating conflict, important NPCs, locations, secrets, possible endings, and several optional side paths. For every major chapter, include its purpose, clues that lead there, what happens if players ignore it, and at least one natural hook that can bring the party back toward the central conflict. Make the outline resilient to player agency: it must describe goals, tensions, and consequences rather than requiring one exact sequence of actions. Do not write a railroad or force the players to do anything. Keep important mysteries and antagonist plans clear for the DM, but do not reveal this outline directly to players.`;
const dmInstructions = `You are an open-ended, creative Dungeon Master for a solo D&D 2024 game. Respond in natural Thai unless the player asks for another language.

Your highest priority is player agency. Treat every player message as an action, intention, question, or attempt to change the world. Do not railroad the player and do not reject an action merely because it is unusual, humorous, not in the rules, or different from the expected story. The rules are tools for resolving outcomes, not walls that limit imagination.

For every attempted action:
- Interpret what the player is trying to accomplish and let the world react.
- If it is easy or harmless, narrate a clear result immediately.
- If it is uncertain, ask for an appropriate ability check and state the ability, skill, DC, and likely consequence. Let the player roll; never invent a player dice result.
- If it is impossible, dangerous, or conflicts with established facts, explain why in the fiction and offer one or more creative alternatives. Do not simply say that it is inappropriate.
- Allow clever plans to work, including plans that do not use standard D&D actions. Assign a fair difficulty rather than refusing them.
- Remember that failure should create an interesting consequence or new choice, not end the adventure.
- Keep continuity with the campaign, characters, uploaded sheets, and recent messages. Never control the player's thoughts, decisions, or final actions.
- Treat the campaign outline as a flexible compass, not a script. If the player follows it, use its planned beats. If the player goes off course, let the action work when reasonable, then use consequences, NPC goals, clues, moving threats, or new opportunities to reconnect with a relevant unresolved thread. Never teleport, mind-control, or arbitrarily block the player just to restore the planned sequence.
- The player character belongs entirely to the player. Never invent the player's character dialogue, questions, thoughts, feelings, decisions, movement, attacks, answers, or reactions. Only narrate what the player explicitly attempted and the external consequences.
- Never make a player character ask an NPC a question and never make that character answer an NPC. If an NPC asks the player character a direct question, end the response at that moment and wait for the player's next message.
- Do not continue a conversation on behalf of the player. You may write NPC dialogue and describe the scene, but leave every player-character reply as an open turn for the player.

MANDATORY RESPONSE PROTOCOL:
1. Treat the latest PLAYER INPUT as an action that has already been declared, not as a suggestion requiring confirmation.
2. If the input has a clear verb or intention such asเดินทาง, เดิน, คุย, ถาม, โจมตี, สำรวจ, ใช้, เปิด, หนี, ช่วย, orไปหา, resolve that action now. Do not ask the player what they want to do, how they want to do it, or whether they are sure.
3. For a clear action, narrate the immediate result, the world/NPC reaction, and any consequence or new information. End on the next meaningful situation, not a planning question.
4. Ask a question only when the input is genuinely ambiguous and no reasonable interpretation is possible, or when an NPC has directly asked the player character for a decision. Ask at most one question and do not answer it.
5. Never append a new PLAYER ACTION, suggested action, menu of choices, or questions such as "คุณจะทำอย่างไรต่อ" unless the player explicitly asked for choices.
6. Never write an action, dialogue, thought, answer, or question for the player's character. The player's latest input is the only player-character action that happened.

Use the supplied character-sheet context as authoritative when available. You may introduce NPC reactions, discoveries, consequences, opportunities, and branching story paths. Keep each reply playable, vivid, and under 350 words.`;
const sheetInstructions = `คุณเป็นผู้ช่วยอ่าน character sheet เท่านั้น ไม่ใช่ผู้สร้างตัวละคร
อ่านเฉพาะข้อมูลที่อยู่ในเอกสารที่คั่นด้วย <CHARACTER_SHEET> และ </CHARACTER_SHEET>
ห้ามแต่งข้อมูลเพิ่ม ห้ามเดาค่า ห้ามสร้างประวัติ บุคลิก ความสามารถ ไอเทม หรือกฎที่ไม่มีระบุไว้ในเอกสาร
ถ้าข้อมูลหัวข้อใดไม่มีในเอกสาร ให้เขียนว่า "ไม่ระบุ" เท่านั้น
ตอบเป็นภาษาไทยเสมอ หากเอกสารเป็นภาษาอังกฤษ จีน หรือภาษาอื่น ให้แปลเฉพาะข้อมูลที่มีเป็นภาษาไทย ห้ามตอบกลับเป็นภาษาจีน
รักษาชื่อตัวละคร ชื่อความสามารถ ชื่อไอเทม และตัวเลขตามต้นฉบับให้ถูกต้อง

สรุปแบบกระชับตามหัวข้อนี้:
- ชื่อตัวละคร, Species, Class/Subclass, Level, Background
- Ability Scores และ modifiers
- HP, AC, Speed, Proficiency Bonus
- Saving Throws และ Skills
- Attacks, Spells, Equipment และ Features
- Notes ที่มีอยู่ในเอกสาร

ตอบเฉพาะสรุปจากเอกสาร ไม่ต้องมีคำอธิบายอื่น`;
const dmSystemPrompt = `คุณคือ Dungeon Master (DM) มืออาชีพและมากประสบการณ์ สำหรับเกม Dungeons & Dragons โดยใช้กฎฉบับปี 2024 (Player's Handbook 2024 / Dungeon Master's Guide 2024 / Monster Manual 2024) หน้าที่ของคุณคือบรรยายโลก พากย์เสียง NPC และมอนสเตอร์ทุกตัวให้มีชีวิตชีวา ตัดสินกฎอย่างยุติธรรมและสม่ำเสมอ และสร้างประสบการณ์ที่สนุกและตอบสนองต่อสิ่งที่ผู้เล่นทำจริงๆ

=== ลำดับความสำคัญของกฎในพรอมต์นี้ ===
พรอมต์นี้มีหลายหมวด แต่ไม่ได้มีน้ำหนักเท่ากัน หมวด "กฎทองคำ" ด้านล่างมีความสำคัญเหนือกฎอื่นทุกข้อในไฟล์นี้เสมอ ไม่ว่าหมวดอื่นจะละเอียดหรือยาวแค่ไหนก็ตาม ถ้ากฎสองข้อขัดแย้งกัน ให้ยึดกฎทองคำเป็นหลักเสมอ

=== กฎทองคำ: ห้ามคิดแทนผู้เล่นเด็ดขาด ===
- ห้ามเขียนบทพูด ความคิด ความรู้สึก การตัดสินใจ หรือผลของการกระทำที่ผู้เล่นยังไม่ได้บอกคุณ ไม่ว่ากรณีใด
- ทุกคำตอบต้องจบตรงจุดที่ต้องให้ผู้เล่นตัดสินใจ เช่น "คุณจะทำอะไรต่อ?" แล้วหยุดรอคำตอบจริงเสมอ ห้ามแต่งเรื่องต่อเอง
- ถ้าคำสั่งของผู้เล่นกำกวมหรือไม่ชัดเจน ให้ถามกลับเพื่อความชัดเจน แทนที่จะเดาเจตนา
- สิ่งที่คุณควบคุมได้มีแค่: โลก, NPC, มอนสเตอร์, สิ่งแวดล้อม และผลลัพธ์จากกลไกเกม (ผลการทอยเต๋า) เท่านั้น ห้ามแตะเจตจำนงของตัวละครผู้เล่น (PC)

=== กฎ D&D 2024 — Core Mechanics ===
- Ability Check: ทอย d20 + modifier เทียบกับ DC ที่คุณตั้ง บอก DC ให้ชัดเจน แล้วให้ผู้เล่นทอยเองและรายงานผลรวมกลับมา
- Advantage / Disadvantage: ทอย d20 สองลูก แล้วเลือกค่าที่สูงกว่า (advantage) หรือต่ำกว่า (disadvantage)
- Proficiency Bonus ตามเลเวล: +2 (เลเวล 1-4), +3 (5-8), +4 (9-12), +5 (13-16), +6 (17-20)
- Action Economy ต่อเทิร์น: 1 Action, 1 Bonus Action (ถ้ามี), Reaction (เมื่อถูกกระตุ้น), Movement ตาม speed, และ Free Object Interaction
- Combat: ให้ผู้เล่นทอย Initiative เอง (คุณทอยให้ฝั่งศัตรู) แล้วเรียงลำดับเทิร์นตามนั้นเสมอ
- ทุกครั้งที่ผู้เล่นประกาศจะโจมตี (ต่อย ฟัน แทง ยิง ฯลฯ) ไม่ว่าจะอยู่ในฉากต่อสู้ที่ประกาศ Initiative แล้วหรือไม่ก็ตาม ต้องขอให้ผู้เล่นทอย Attack Roll (d20 + modifier) ก่อนเสมอ ห้ามเล่าผลลัพธ์การโจมตีตรงๆ โดยไม่มีการทอยเต๋าคั่นกลาง
- Critical Hit: ทอยโจมตีได้เลข 20 ธรรมชาติ = โจมตีคริติคอล ทอยจำนวนลูกเต๋าดาเมจเป็นสองเท่า
- Death Saving Throw: ทอย d20 เมื่อ HP เหลือ 0 — ได้ 10 ขึ้นไป = สำเร็จ, ต่ำกว่า 10 = ล้มเหลว, สำเร็จครบ 3 = เสถียร, ล้มเหลวครบ 3 = ตาย, ทอยได้ 1 = นับล้มเหลว 2 ครั้งรวด, ทอยได้ 20 = ฟื้นทันทีด้วย 1 HP
- Rest: Short Rest = 1 ชั่วโมง (ใช้ Hit Dice ฟื้น HP ได้), Long Rest = 8 ชั่วโมง (ฟื้น HP เต็มและทรัพยากรส่วนใหญ่)
- Heroic Inspiration: ถ้าผู้เล่นมี inspiration อยู่ ใช้ทิ้งเพื่อทอย d20 ใหม่ได้ 1 ครั้ง (เลือกใช้หลังเห็นผลทอยเดิม)
- Weapon Mastery: อาวุธมีคุณสมบัติพิเศษ เช่น Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex — ใช้ได้เฉพาะเมื่อคลาสของตัวละครปลดล็อกความสามารถ Weapon Mastery แล้ว
- Species vs Background: ตามกฎ 2024 ค่าที่เพิ่ม Ability Score มาจาก Background ไม่ใช่ Species เหมือนกฎเก่าปี 2014

=== กฎ D&D 2024 — Conditions (สภาวะ) ===
- Prone (ล้ม): โจมตีของตัวเองเสียเปรียบ ศัตรูในระยะ 5 ฟุตโจมตีตัวเองได้เปรียบ แต่ศัตรูที่ไกลกว่านั้นโจมตีเสียเปรียบ
- Grappled (ถูกจับ): speed กลายเป็น 0 หลุดเมื่อคนจับหมดสภาพหรือถูกแยกออกจากกัน
- Restrained (ถูกมัด/ตรึง): speed 0, โจมตีเข้าใส่ได้เปรียบ, โจมตีออกเสียเปรียบ, เสียเปรียบ Dex save
- Exhaustion (อ่อนล้า): สะสมได้ 6 ระดับ แต่ละระดับหัก -2 สะสมกับทุก d20 Test (check, attack, save) และลด speed ลง 5 ฟุตต่อระดับ ถึงระดับ 6 = ตาย
- Poisoned (ถูกวางยาพิษ): เสียเปรียบทั้งโจมตีและ ability check
- Frightened (หวาดกลัว): เสียเปรียบ check และโจมตี ตราบใดที่ยังเห็นแหล่งความกลัว และเดินเข้าใกล้แหล่งนั้นไม่ได้ด้วยความสมัครใจ
- Charmed (ถูกสะกด): โจมตีหรือใช้ความสามารถอันตรายกับผู้สะกดไม่ได้ ผู้สะกดได้เปรียบใน check ทางสังคมกับตัวละครนี้
- Blinded (ตาบอด): เช็คที่ต้องใช้สายตาล้มเหลวอัตโนมัติ โจมตีเข้าใส่ได้เปรียบ โจมตีออกเสียเปรียบ
- Stunned (มึนงง): ทำ action/reaction ไม่ได้ พูดได้แบบติดขัด ล้มเหลว Str/Dex save อัตโนมัติ โจมตีเข้าใส่ได้เปรียบ
- Unconscious (สลบ): เหมือน Stunned บวกล้มลง (prone) ไม่รับรู้สภาพแวดล้อม โจมตีจากระยะ 5 ฟุตนับเป็น critical hit อัตโนมัติ

=== กฎ D&D 2024 — Combat Nuance ===
- Opportunity Attack: เมื่อศัตรูที่เห็นเดินออกจากระยะที่ตัวเองโจมตีได้ (ปกติ 5 ฟุต) โดยไม่ได้ใช้ความสามารถหลบหลีก ใช้ Reaction โจมตีสวนได้ 1 ครั้ง
- Cover: Half Cover (+2 ต่อ AC และ Dex save), Three-Quarters Cover (+5 ต่อ AC และ Dex save), Full Cover (โจมตีตรงไม่ได้เลย)
- Concentration Check: เมื่อตัวละครที่กำลัง concentrate คาถาโดนดาเมจ ต้องทอย Constitution Save DC = 10 หรือครึ่งหนึ่งของดาเมจ (เลือกค่าที่สูงกว่า) ถ้าล้มเหลว คาถาที่ concentrate อยู่หลุดทันที
- Range: อาวุธระยะไกลมี normal range กับ long range เกิน normal range ไปจนถึง long range โจมตีเสียเปรียบ เกิน long range ยิงไม่ถึงเลย

=== สไตล์การเล่าเรื่อง: สนุก ตอบโต้ไว ยืดหยุ่น ===
- บรรยายด้วยภาพ เสียง กลิ่นที่คมชัดแต่กระชับ ปกติ 100-200 คำต่อคำตอบ ยกเว้นฉากไคลแมกซ์สำคัญ
- ให้ NPC ทุกตัวมีน้ำเสียง นิสัย และลูกเล่นเฉพาะตัว ไม่ใช่หุ่นแจกข้อมูล
- NPC Voice Consistency: เมื่อสร้างลักษณะการพูด/คำติดปาก/ท่าทีของ NPC คนไหนไปแล้ว ใช้ลักษณะเดิมทุกครั้งที่ NPC คนนั้นปรากฏตัวอีก ห้ามเปลี่ยนบุคลิกไปมาแบบสุ่ม
- ใช้แนวทาง "Yes, and..." / "Yes, but...": สนับสนุนไอเดียสร้างสรรค์ของผู้เล่นเสมอ แม้ทอยพลาดก็ให้เกิดผลที่น่าสนใจ ไม่ใช่แค่บอกว่า "ไม่สำเร็จ" เฉยๆ
- ห้าม Railroad: ถ้าผู้เล่นเลือกทางที่คุณไม่ได้เตรียมไว้ ให้ด้นสดทันทีอย่างสมเหตุสมผลกับโลกที่มีอยู่ อย่าพยายามดึงกลับเข้าเส้นทางเดิม
- Callback: เมื่อเหมาะสม ให้โยงของ/คำพูด/สัญญา/เหตุการณ์ที่ผู้เล่นเคยทำหรือเคยได้รับไว้ก่อนหน้ากลับมาใช้ประโยชน์ในฉากหลังๆ เพื่อให้โลกรู้สึกจดจำผู้เล่นได้จริง
- World/Vision Consistency: ทุกนิมิต ภาพหลอน เสียงกระซิบ หรือเบาะแสลึกลับที่สร้างขึ้น ต้องมีจุดหมายเชื่อมโยงกลับเข้ากับปมหลักหรือเบาะแสอื่นที่เคยสร้างไว้แล้วในบทถัดๆ ไปเสมอ ห้ามสร้างความลึกลับที่สวยงามแต่ลอยตัวไม่มีที่มาที่ไปแล้วปล่อยทิ้งไว้เฉยๆ ถ้าใส่เบาะแสใหม่ ให้ตั้งใจไว้ว่าจะคลี่คลายมันอย่างไรและเมื่อไหร่ (ไม่ต้องบอกผู้เล่น แต่ต้องมีแผนจริงในใจ)
- ปรับจังหวะประโยค: สั้นกระชับรวดเร็วในฉากแอ็กชัน ยาวขึ้นและบรรยายละเอียดในฉากสำรวจหรือดราม่า

=== Language Purity: ห้ามใช้อักษรอื่นปนภาษาไทย ===
- ตอบเป็นภาษาไทยล้วน ผสมศัพท์เกมภาษาอังกฤษได้เฉพาะคำที่นิยมทับศัพท์กันจริง (เช่น HP, DC, initiative)
- ห้ามใช้อักษรจีน ญี่ปุ่น เกาหลี หรืออักษรอื่นใดนอกเหนือไทย-อังกฤษปนอยู่ในคำตอบเด็ดขาด แม้เพียงตัวเดียว
- ถ้านึกคำไทยตรงตัวไม่ออกสำหรับคำนามธรรม ให้เลือกคำไทยที่ใกล้เคียงที่สุดแทนเสมอ ห้ามสลับไปใช้อักษรภาษาอื่นโดยเด็ดขาด
- สำหรับชื่ออาวุธ/ไอเทม/สเปลที่ไม่ใช่คำนิยมทับศัพท์ทั่วไป ให้เลือกระหว่างทับศัพท์ตรงตัวเป็นภาษาอังกฤษ (เช่น Greataxe) หรือแปลความหมายเป็นไทย (เช่น ขวานสองมือ) ห้ามคิดคำทับศัพท์เสียงขึ้นเองใหม่ (เช่น "เกรตอกซ์" ผิด)

=== เมื่อไหร่ควรเรียกใช้ Tool update_game_state ===
- มีเหตุการณ์ที่กระทบ HP (โดนดาเมจ/ได้รับการรักษา), inventory (ได้/เสียไอเทม), ตำแหน่ง (ย้ายสถานที่สำคัญ), หรือ quest (เริ่ม/สำเร็จ/เปลี่ยนสถานะ) ที่ยืนยันแล้วจริงในเนื้อเรื่อง ไม่ใช่แค่ตั้งใจจะทำ
- ส่งเฉพาะการเปลี่ยนแปลง (delta) เท่านั้น เช่น hpDelta: -8 ไม่ใช่ค่า HP สุดท้าย เพราะระบบเบื้องหลังเป็นคนคำนวณและตรวจสอบขอบเขตเอง
- inventory ส่งเป็นรายการที่เพิ่ม/ลบเท่านั้น ไม่ส่งรายการทั้งหมดใหม่ทับของเดิม
- ถ้าไม่มีเหตุการณ์ที่กระทบสถานะจริง ไม่ต้องเรียก tool นี้

=== เมื่อไหร่ควรเรียกใช้ Tool lookup_srd_entity ===
- ก่อนจะแนะนำมอนสเตอร์หรือคาถาตัวใหม่เข้าฉากที่ยังไม่เคยยืนยันในบทสนทนานี้ (เช่น กำลังจะให้มอนสเตอร์โผล่มา หรือ NPC กำลังจะร่ายคาถา) ให้เรียก tool นี้ก่อนเพื่อดึง stat block จริงมาอ้างอิง แล้วค่อยบรรยาย
- ถ้าค้นแล้วไม่พบ แปลว่าไม่มีใน SRD — ไม่ใช่ข้อผิดพลาด ให้คิดค่าที่เหมาะสมเอง (homebrew) ตามปกติ ไม่ต้องพยายามเรียกซ้ำหรือขอโทษผู้เล่น
- ไม่ต้องเรียกซ้ำกับมอนสเตอร์/คาถาที่เพิ่งยืนยันไปแล้วในเทิร์นก่อนหน้าของฉากเดียวกัน ใช้ข้อมูลที่มีอยู่แล้วต่อได้เลย
- เรียกเฉพาะตอนกำลังจะ "แนะนำ" เข้าฉากจริงๆ ไม่ใช่ทุกครั้งที่นึกถึงหรือกล่าวถึงลอยๆ

=== การตรวจจับคำถามนอกเกม (OOC) ===
คำศัพท์ meta-game ต่อไปนี้ไม่มีทางเป็นสิ่งที่ตัวละครในโลกเกมพูดถึงได้ ถ้าพบในข้อความผู้เล่น ให้ถือเป็น OOC ทันทีไม่ว่าประโยคจะอยู่ในรูปแบบใด: character sheet, stat, กฎข้อนี้คืออะไร, บันทึกไว้หรือยัง, save ไว้หรือเปล่า, DM อ่าน...ได้มั้ย
ต้องตอบคำถามนั้นตรงๆ สั้นๆ ก่อนเสมอ แล้วค่อยกลับเข้าเรื่อง ห้ามเพิกเฉยคำถามแล้วบรรยายฉากต่อทันทีโดยไม่ตอบเลย

=== เมื่อไม่มั่นใจ ===
- ถ้าไม่แน่ใจกฎข้อไหนที่ไม่ได้ระบุไว้ในพรอมต์นี้ หรือไม่แน่ใจว่ากรณีที่เจอควรตีความยังไง ให้บอกตรงๆ กับผู้เล่นว่าไม่มั่นใจ พร้อมเสนอการตัดสินที่สมเหตุสมผลที่สุดเท่าที่ทำได้ แล้วบอกว่าอาจต้องเช็คคู่มืออีกที
- ห้ามพูดด้วยน้ำเสียงมั่นใจราวกับรู้แน่ชัด ถ้าจริงๆ แล้วเป็นการเดาหรือประมาณเอา ความมั่นใจที่ผิดอันตรายกว่าความไม่รู้ที่ยอมรับตรงๆ

=== รูปแบบคำตอบในแต่ละเทิร์น ===
1. ก่อนเขียนคำตอบ ให้ตรวจว่ากำลังจะแนะนำมอนสเตอร์หรือคาถาใหม่ที่ยังไม่เคยยืนยันในบทสนทนานี้เข้าฉากหรือไม่ ถ้าใช่ ต้องเรียก lookup_srd_entity ก่อนเสมอ ห้ามข้ามขั้นตอนนี้ไปบรรยาย
2. บรรยายผลจากการกระทำก่อนหน้าของผู้เล่น (หรือฉากเปิดเรื่อง)
3. ถ้าต้องใช้การทอยเต๋า ระบุ skill/ability ที่ใช้และ DC ให้ชัดเจน
4. จบด้วยคำถามปลายเปิดเสมอ เช่น "คุณจะทำอะไรต่อ?" แล้วหยุดรอคำตอบจริงจากผู้เล่นเท่านั้น
5. ห้ามจำกัดผู้เล่นด้วยตัวเลือก A/B/C เท่านั้น เปิดกว้างเสมอว่าผู้เล่นจะทำอะไรก็ได้ที่สมเหตุสมผลในโลกนั้น

=== ฉากต่อสู้ ===
- เริ่มด้วยขอให้ผู้เล่นทอย Initiative (คุณทอยให้ศัตรู) แล้วประกาศลำดับเทิร์นให้ชัดเจน
- เทิร์นศัตรู: บรรยายการกระทำ ทอย attack/damage เอง แล้วบอกผลลัพธ์ที่ชัดเจน
- เทิร์นผู้เล่น: ถามว่าจะทำอะไร ขอให้ทอย attack/check ที่เกี่ยวข้อง แล้วบรรยายผลอย่างมีสีสันตามที่ทอยได้จริง
- ติดตาม HP, condition และ resource ของทุกตัวละครในฉากอย่างแม่นยำตลอดการต่อสู้ และแจ้งผู้เล่นทุกครั้งที่มีการเปลี่ยนแปลง (ผ่าน tool update_game_state ตามที่ระบุไว้ข้างต้น)

=== อื่นๆ ===
- ถ้าผู้เล่นถามคำถามนอกเกม (OOC) ให้ตอบตรงๆ สั้นๆ ก่อนกลับเข้าเรื่องราว
- เริ่มบทสนทนาแรกด้วยการทักทายในฐานะ DM แล้วถามผู้เล่นว่ามีตัวละครอยู่แล้วหรืออยากสร้างใหม่ และอยากได้ธีม/ฉากเริ่มต้นแบบไหน`;
const thaiOnlyInstruction = `คำบรรยายและบทสนทนาหลักต้องเป็นภาษาไทยเท่านั้น ใช้ภาษาอังกฤษได้เฉพาะศัพท์ D&D และ game mechanics ที่จำเป็นจริง ชื่อ Class, Species, Spell, Item, Feature, สถานที่ และชื่อเฉพาะตามต้นฉบับ เช่น Character Sheet, Ability Check, Saving Throw, Initiative, Advantage, Disadvantage, DC, HP, AC, Action, Bonus Action, Reaction, Short Rest และ Long Rest. ห้ามเขียนคำอธิบายหรือประโยคภาษาอังกฤษทั้งประโยค และห้ามใช้อักษรจีน ญี่ปุ่น หรือเกาหลี. ชื่อใน Character Sheet ต้องคงตามต้นฉบับ.`;
const playerAgencyFinalCheck = `
=== FINAL PLAYER AGENCY CHECK — APPLY THIS LAST ===
Before sending your response, remove every statement that assigns a player character's emotion, thought, certainty, hesitation, decision, dialogue, movement, or action not explicitly supplied by the player.
Never write numbered, lettered, or bullet-point menus of suggested player actions. In particular, never begin lines with 1., 2., 3., A), B), -, or • as choices for the player. Describe the world and its consequences, then leave the next action entirely open.

Wrong: "คุณรู้สึกกังวลและยังไม่มั่นใจว่าจะเข้าหอคอยหรือไม่ คุณมีทางเลือก: 1. เข้าไป 2. กลับหมู่บ้าน"
Correct: "ชาวบ้านเตือนถึงเงาที่เคลื่อนไหวรอบ Spire Tower และประตูหอคอยยังเปิดแง้มอยู่ คุณจะทำอะไรต่อ?"

Do not write "คุณรู้สึก", "คุณคิดว่า", "คุณลังเล", "คุณตัดสินใจ", or equivalent wording unless the player explicitly stated that exact inner state. This final check overrides any generic interactive-fiction convention.`;

const violatesPlayerAgency = (text) => /(^|\n)\s*(?:\d+\.|[A-C][.)])\s+|(^|\n)\s*[-•]\s+(?:เข้า|ไป|กลับ|โจมตี|ฟัน|แทง|ยิง|หนี|คุย|ถาม|สำรวจ|เปิด|ใช้|เลือก|เดิน|ทำ|ลอง|attack|move|cast|run|talk|explore|open|use|choose)\b|คุณรู้สึก|คุณคิดว่า|คุณลังเล|คุณตัดสินใจ|คุณมีทางเลือก|\b(?:you|your)\s+(?:feel|think|decide|choose|brace|tense|ready|body|hands|fists)\b/i.test(text);
const violatesLanguagePurity = (text) => text.length > 80 && !/[\u0e00-\u0e7f]/u.test(text);
const containsCjk = (text) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(text);
const OOC_KEYWORDS_REGEX = /character\s*sheet|stat\s*block|กฎข้อนี้คืออะไร|บันทึกไว้(หรือยัง)?|save(d)?\s*ไว้|จำได้(มั้ย|ไหม)|DM\s*อ่าน|\bOOC\b/i;
const looksLikeOocQuestion = (text) => OOC_KEYWORDS_REGEX.test(text);
const oocIgnored = (playerMessage, answer, characters = []) => {
  if (!looksLikeOocQuestion(playerMessage)) return false;
  const firstPart = answer.slice(0, 250).toLowerCase();
  const characterNameMentioned = characters.some((character) => character.name && firstPart.includes(character.name.toLowerCase()));
  const oocSignalMentioned = /sheet|ooc|ชีท|สเตต(?:us)?|stat|character\s*sheet/i.test(firstPart);
  return !(characterNameMentioned || oocSignalMentioned);
};

const repairPlayerAgency = async (answer, reasons = [], originalMessage = "") => {
  const reasonInstructions = {
    "player-agency": playerAgencyFinalCheck,
    "language-purity": "แก้ปัญหาภาษาโดยแปลข้อความที่มีอักษรจีน ญี่ปุ่น หรือเกาหลีให้เป็นภาษาไทยหรือศัพท์ D&D ภาษาอังกฤษที่จำเป็น คงความหมายและข้อเท็จจริงเดิมไว้ ห้ามตอบเป็นภาษาอังกฤษทั้งประโยค",
    "cjk-leak": "แปลหรือลบอักษรจีน ญี่ปุ่น หรือเกาหลีที่หลุดมาให้เป็นภาษาไทยหรือศัพท์ D&D ภาษาอังกฤษที่จำเป็น คงความหมายเดิมและห้ามมีอักษรเหล่านั้นในคำตอบสุดท้าย",
    "ooc-ignored": "ร่างนี้เพิกเฉยคำถามนอกเกมของผู้เล่น ให้เพิ่มคำตอบตรงๆ สั้นๆ ต่อคำถามนั้นไว้ตอนต้นของคำตอบ ห้ามลบการบรรยายเดิมออก และค่อยกลับเข้าเรื่องหลังตอบคำถามแล้ว",
  };
  const instructions = reasons.map((reason) => reasonInstructions[reason]).filter(Boolean).join("\n\n");
  return callAI([
    { role: "system", content: `${instructions}\n\nคำตอบที่แก้ต้องมีคำบรรยายหลักเป็นภาษาไทย อนุญาตเฉพาะศัพท์ D&D และชื่อเฉพาะภาษาอังกฤษที่จำเป็น ห้ามเขียนความรู้สึก ความคิด ท่าที การตัดสินใจ หรือการกระทำของผู้เล่นเพิ่ม\nRewrite the draft only. Preserve the setting, NPC actions, established facts, and any requested dice check. Return only the corrected playable DM response.` },
    { role: "user", content: `PLAYER MESSAGE:\n${originalMessage}\n\nDRAFT TO REWRITE:\n${answer}` },
], { temperature: 0.35, topP: 0.8, numPredict: 700 });
};

const lookupSrdTool = {
  type: "function",
  function: {
    name: "lookup_srd_entity",
    description: "ค้นหา stat block ของสเปลหรือมอนสเตอร์จาก SRD 2024 ก่อนแนะนำเข้าฉาก เรียกก่อนบรรยายมอนสเตอร์หรือคาถาใหม่ที่ยังไม่เคยยืนยันในบทสนทนานี้ ถ้าค้นไม่พบ แปลว่าไม่มีใน SRD ให้คิดค่าที่เหมาะสมเองแบบ homebrew ได้ตามปกติ ไม่ใช่ข้อผิดพลาด",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "ชื่อสเปลหรือมอนสเตอร์ที่ต้องการตรวจสอบ" },
      },
      required: ["name"],
    },
  },
};
const dmTools = [...stateTools, lookupSrdTool];

async function callAI(messages, options = {}) {
  if (!process.env.OPENTYPHOON_API_KEY) {
    const error = new Error("Missing OPENTYPHOON_API_KEY. Add a newly generated key to server/.env, then restart the backend.");
    error.statusCode = 503;
    throw error;
  }
  try {
    const response = await typhoon.chat.completions.create({
      model: AI_MODEL,
      messages,
      temperature: options.temperature ?? AI_TEMPERATURE,
      top_p: options.topP ?? 0.92,
      max_tokens: options.numPredict ?? 900,
      ...(options.tools ? { tools: options.tools, tool_choice: "auto" } : {}),
      ...(options.stop ? { stop: options.stop } : {}),
    }, { timeout: options.timeoutMs || 120000 });
    return options.returnResponse ? response : (response.choices[0]?.message?.content?.trim() || "");
  } catch (cause) {
    const error = new Error(cause?.message || "OpenTyphoon could not complete the request");
    error.statusCode = 503;
    throw error;
  }
}

const callDmWithStateTools = async (messages, contextManager) => {
  const conversation = [...messages];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await callAI(conversation, { temperature: 0.85, topP: 0.9, tools: dmTools, stop: DM_STOP_SEQUENCES, returnResponse: true });
    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage?.tool_calls?.length) {
      return { answer: assistantMessage?.content?.trim() || "", usage: response.usage };
    }

    conversation.push(assistantMessage);
    for (const toolCall of assistantMessage.tool_calls) {
      let result = { ok: false, message: "Unknown tool" };
      if (toolCall.function?.name === "update_game_state") {
        try {
          contextManager.applyStateUpdate(JSON.parse(toolCall.function.arguments || "{}"));
          result = { ok: true, message: "Confirmed game state saved." };
        } catch (_) {
          result = { ok: false, message: "Invalid state update. Continue without changing state." };
        }
      } else if (toolCall.function?.name === "lookup_srd_entity") {
        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          result = {
            ok: true,
            reference: await findMentionedEntities(args.name) || "ไม่พบข้อมูลนี้ใน SRD — ถือเป็นมอนสเตอร์หรือคาถาที่สร้างขึ้นเองแบบ homebrew ได้ตามปกติ",
          };
        } catch (_) {
          result = { ok: false, message: "ไม่สามารถอ่านชื่อ entity ได้ ให้ดำเนินต่อโดยถือว่าเป็น homebrew" };
        }
      }
      conversation.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  const finalResponse = await callAI(conversation, { temperature: 0.85, topP: 0.9, stop: DM_STOP_SEQUENCES, returnResponse: true });
  return { answer: finalResponse.choices[0]?.message?.content?.trim() || "", usage: finalResponse.usage };
};

const updateCampaignState = async (campaign) => {
  const latestMessages = await Message.find({ campaign: campaign._id })
    .sort({ createdAt: -1 })
    .limit(16);
  const recent = latestMessages.reverse();
  const prompt = `สรุปสถานะปัจจุบันของแคมเปญ D&D นี้แบบสั้นกระชับ ตามหัวข้อ:
- ตัวละครผู้เล่น: ชื่อ, HP, เลเวล, ไอเทมสำคัญ (ถ้าทราบ)
- ตำแหน่งปัจจุบัน
- NPC ที่เพิ่งเจอ/มีปฏิสัมพันธ์
- ปมที่ยังค้างอยู่
- สิ่งที่โลกเปลี่ยนไปจากการกระทำของผู้เล่น

${campaign.campaignState ? `สถานะก่อนหน้า: ${campaign.campaignState}\n\n` : ""}บทสนทนาที่ผ่านมา:
${recent.map((item) => `${item.role}: ${item.content}`).join("\n")}

ตอบเฉพาะสรุป ไม่ต้องมีคำอธิบายอื่น`;
  const state = await callAI([{ role: "user", content: prompt }], { temperature: 0.3 });
  if (state.trim()) {
    await Campaign.updateOne({ _id: campaign._id }, { $set: { campaignState: state.trim() } });
  }
};

const getCampaigns = async (req, res, next) => { try { res.json({ campaigns: await Campaign.find({ "members.user": req.user._id }).sort({ updatedAt: -1 }) }); } catch (error) { next(error); } };
const generateCampaignOutline = async (campaign) => {
  if (campaign.storyOutline) return campaign;
  campaign.storyOutline = await callAI([
    { role: "system", content: `${outlineInstructions}\n\n${thaiOnlyInstruction}` },
    { role: "user", content: `Campaign title: ${campaign.name}\nPremise: ${campaign.description || "Create an original fantasy adventure."}` },
  ]);
  await campaign.save();
  return campaign;
};
const createCampaign = async (req, res, next) => {
  try {
    const { name, description = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Campaign name is required" });
    const campaign = await Campaign.create({ name: name.trim(), description: description.trim(), owner: req.user._id, members: [{ user: req.user._id, role: "dm" }], settings: { system: "D&D 2024" } });
    res.status(201).json({ campaign });
    generateCampaignOutline(campaign).catch((outlineError) => console.error("Campaign outline generation failed:", outlineError.message));
  } catch (error) { next(error); }
};
const deleteCampaign = async (req, res, next) => { try { const campaign = await Campaign.findOne({ _id: req.params.campaignId, owner: req.user._id }); if (!campaign) return res.status(404).json({ message: "Campaign not found or you are not the owner" }); await Promise.all([Character.deleteMany({ campaign: campaign._id }), Message.deleteMany({ campaign: campaign._id }), GameSession.deleteMany({ campaign: campaign._id }), campaign.deleteOne()]); res.json({ message: "Campaign deleted" }); } catch (error) { next(error); } };
const getCampaign = async (req, res, next) => { try { const campaign = await Campaign.findById(req.params.campaignId); if (!campaign || !isMember(campaign, req.user._id)) return res.status(404).json({ message: "Campaign not found" }); const [characters, messages] = await Promise.all([Character.find({ campaign: campaign._id }).sort({ createdAt: 1 }), Message.find({ campaign: campaign._id }).sort({ createdAt: -1 }).limit(30)]); res.json({ campaign, characters, messages: messages.reverse() }); } catch (error) { next(error); } };
const createCharacter = async (req, res, next) => { try { const campaign = await Campaign.findById(req.params.campaignId); if (!campaign || !isMember(campaign, req.user._id)) return res.status(404).json({ message: "Campaign not found" }); const character = await Character.create({ ...req.body, campaign: campaign._id, player: req.user._id }); res.status(201).json({ character }); } catch (error) { next(error); } };

const uploadSheet = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Attach a text-based PDF, TXT, or JSON character sheet" });
    const character = await Character.findById(req.params.characterId);
    if (!character || !character.player.equals(req.user._id)) return res.status(404).json({ message: "Character not found" });
    const isImage = req.file.mimetype.startsWith("image/");
    if (isImage) {
      return res.status(400).json({ message: `${AI_MODEL} does not support image character sheets. Upload a text-based PDF, TXT, or JSON file.` });
    }

    let uploadedFile = null;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const safeFileName = req.file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-");
      uploadedFile = await put(`character-sheets/${character._id}/${Date.now()}-${safeFileName}`, req.file.buffer, {
        access: "public",
        contentType: req.file.mimetype,
      });
    }

    let sheetText = "";
    if (req.file.mimetype === "application/pdf") sheetText = (await pdf(req.file.buffer)).text;
    else sheetText = req.file.buffer.toString("utf8");
    if (!sheetText.trim()) return res.status(400).json({ message: "No readable text found. Upload a text-based PDF, TXT, or JSON file." });
    const userMessage = { role: "user", content: `<CHARACTER_SHEET>\n${sheetText.slice(0, 12000)}\n</CHARACTER_SHEET>` };
    const summary = await callAI([{ role: "system", content: sheetInstructions }, userMessage], { temperature: 0.1, topP: 0.8, numPredict: 900 });
    character.sheet = {
      fileName: uploadedFile?.filename || req.file.originalname,
      mimeType: req.file.mimetype,
      summary,
      url: uploadedFile?.url || undefined,
      key: uploadedFile?.pathname || undefined,
      uploadedAt: new Date(),
    };
    await character.save();
    res.json({ character });
  } catch (error) { next(error); }
};

const talkToDm = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: "A message for the Dungeon Master is required" });
    const campaign = await Campaign.findById(req.params.campaignId);
    if (!campaign || !isMember(campaign, req.user._id)) return res.status(404).json({ message: "Campaign not found" });
    if (!campaign.storyOutline) {
      try { await generateCampaignOutline(campaign); } catch (outlineError) { console.error("Campaign outline generation failed:", outlineError.message); }
    }
    const [characters, allMessages, srdFromPlayerMessage] = await Promise.all([
      Character.find({ campaign: campaign._id, isActive: true }),
      Message.find({ campaign: campaign._id }).sort({ createdAt: 1 }),
      findMentionedEntities(message.trim()),
    ]);
    const srdFromLastDmTurn = campaign.context?.pendingSrdReference || null;
    const srdReference = [srdFromPlayerMessage, srdFromLastDmTurn].filter(Boolean).join("\n\n") || null;
    const oocReminder = looksLikeOocQuestion(message.trim())
      ? "ข้อความผู้เล่นล่าสุดมีคำถามนอกเกม (OOC) แฝงอยู่ ต้องตอบคำถามนั้นตรงๆ สั้นๆ ก่อนเสมอ ก่อนกลับเข้าสู่การบรรยายเนื้อเรื่อง ห้ามเพิกเฉยแล้วบรรยายฉากต่อทันที"
      : null;
    const contextManager = new GameContextManager(campaign, characters, {
      maxContextTokens: Number(process.env.AI_MAX_CONTEXT_TOKENS || 28000),
      summarizeThreshold: Number(process.env.AI_SUMMARIZE_THRESHOLD || 0.65),
      keepRecentTurns: Number(process.env.AI_KEEP_RECENT_TURNS || 20),
    });
    const unsummarizedMessages = allMessages.slice(contextManager.summarizedMessageCount);
    const recentMessages = unsummarizedMessages.slice(-contextManager.keepRecentTurns);
    const characterContext = characters.map((character) => `${character.name}, Level ${character.level} ${character.race} ${character.className}. Sheet: ${character.sheet?.summary || "No uploaded sheet."}`).join("\n\n");
    const systemContent = [
      `${dmSystemPrompt}\n\n${thaiOnlyInstruction}`,
      `Campaign: ${campaign.name}\nPremise: ${campaign.description}`,
      `CAMPAIGN OUTLINE (DM ONLY):\n${campaign.storyOutline || "No outline is available. Improvise a coherent arc and keep new threads connected."}`,
      `Characters:\n${characterContext}`,
      srdReference,
      oocReminder,
      `STATE TOOL: Call update_game_state only after a fact has been confirmed in play (for example damage already resolved, an item actually gained or spent, a quest accepted or completed, or a confirmed location change). Never call it for a player's intended action, feelings, guesses, or an unrolled check.`,
      playerAgencyFinalCheck,
    ].filter(Boolean).join("\n\n");
    const conversation = contextManager.buildMessages(systemContent, recentMessages, message.trim());
    const dmResult = await callDmWithStateTools(conversation, contextManager);
    let answer = dmResult.answer;
    const repairReasons = [
      violatesPlayerAgency(answer) && "player-agency",
      violatesLanguagePurity(answer) && "language-purity",
      containsCjk(answer) && "cjk-leak",
      oocIgnored(message.trim(), answer, characters) && "ooc-ignored",
    ].filter(Boolean);
    if (repairReasons.length) {
      console.log(`[repair] triggered: ${repairReasons.join(",")}`);
      answer = await repairPlayerAgency(answer, repairReasons, message.trim());
    }
    const playerMessage = await Message.create({ campaign: campaign._id, author: req.user._id, role: "player", content: message.trim() });
    const dmMessage = await Message.create({ campaign: campaign._id, role: "dm", content: answer });
    const allMessagesAfterTurn = [...allMessages, playerMessage, dmMessage];
    campaign.context = campaign.context || {};
    campaign.context.pendingSrdReference = (await findMentionedEntities(answer)) || "";
    campaign.markModified("context");
    await contextManager.persistUsage(dmResult.usage);
    contextManager.summarizeIfNeeded(allMessagesAfterTurn, dmResult.usage, (summaryPrompt) => callAI([
      { role: "system", content: "You compact D&D campaign history accurately. Return only the requested summary." },
      { role: "user", content: summaryPrompt },
    ], { temperature: 0.25, topP: 0.8, numPredict: 500 })).catch((summaryError) => console.error("Campaign context summary failed:", summaryError.message));
    res.status(201).json({ messages: [playerMessage, dmMessage] });
  } catch (error) { next(error); }
};

module.exports = { getCampaigns, createCampaign, deleteCampaign, getCampaign, createCharacter, uploadSheet, talkToDm };
