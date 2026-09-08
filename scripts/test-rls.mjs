import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vhcffdlycrwxqbehqtyn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cNSMMjLwSoC3EVNH5qASXQ_BJFonUWN';

async function runRlsTest() {
  console.log('=== BẮT ĐẦU TEST RLS CHÉO 2 TÀI KHOẢN ===\n');

  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const timestamp = Date.now();
  const emailA = `test_usera_${timestamp}@gmail.com`;
  const emailB = `test_userb_${timestamp}@gmail.com`;
  const password = 'TestPassword123!';

  console.log(`1. Đăng ký User A: ${emailA}`);
  const { data: authDataA, error: errSignUpA } = await clientA.auth.signUp({
    email: emailA,
    password: password,
    options: { data: { display_name: 'User A Test' } }
  });

  if (errSignUpA) {
    console.error('Lỗi tạo User A:', errSignUpA.message);
    return;
  }
  const userA = authDataA.user;
  console.log(`   -> User A ID: ${userA?.id}`);

  // Chờ session hoặc tự sign in lại nếu cần
  if (!authDataA.session) {
    console.log('   (Sign in User A để lấy session)');
    const { data: signInA, error: errInA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password: password,
    });
    if (errInA) {
      console.error('   -> Không thể đăng nhập User A (có thể cần tắt email confirmation trên Supabase):', errInA.message);
    }
  }

  console.log(`\n2. User A tạo 1 bản ghi meal_logs`);
  const { data: insertMealA, error: errInsertA } = await clientA
    .from('meal_logs')
    .insert([
      {
        user_id: userA.id,
        food_name: 'Phở bò của User A (Private Data)',
        estimated_calories: 550,
        protein_g: 25,
        carb_g: 65,
        fat_g: 15,
        portion_size: '1 tô',
        is_ai_estimated: true,
      }
    ])
    .select();

  if (errInsertA) {
    console.error('   Lỗi insert meal User A:', errInsertA.message);
  } else {
    console.log('   -> Insert thành công:', insertMealA);
  }

  const mealAId = insertMealA?.[0]?.id;

  console.log(`\n3. Đăng ký User B: ${emailB}`);
  const { data: authDataB, error: errSignUpB } = await clientB.auth.signUp({
    email: emailB,
    password: password,
    options: { data: { display_name: 'User B Test' } }
  });

  if (errSignUpB) {
    console.error('Lỗi tạo User B:', errSignUpB.message);
    return;
  }
  const userB = authDataB.user;
  console.log(`   -> User B ID: ${userB?.id}`);

  if (!authDataB.session) {
    console.log('   (Sign in User B để lấy session)');
    const { error: errInB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password: password,
    });
    if (errInB) {
      console.error('   -> Không thể đăng nhập User B:', errInB.message);
    }
  }

  console.log(`\n4. KIỂM TRA RLS: User B cố gắng đọc toàn bộ meal_logs:`);
  const { data: allMealsForB, error: errReadAllB } = await clientB
    .from('meal_logs')
    .select('*');

  if (errReadAllB) {
    console.log('   -> Truy vấn bị lỗi:', errReadAllB.message);
  } else {
    console.log(`   -> Số lượng bản ghi User B thấy: ${allMealsForB.length}`);
    console.log('   -> Chi tiết:', allMealsForB);
    const hasDataOfA = allMealsForB.some(m => m.user_id === userA.id);
    if (hasDataOfA) {
      console.error('   ❌ NGUY HIỂM: User B ĐỌC ĐƯỢC dữ liệu của User A! RLS chưa hoạt động đúng!');
    } else {
      console.log('   ✅ BẢO MẬT: User B KHÔNG thấy bất kỳ bản ghi nào của User A.');
    }
  }

  if (mealAId) {
    console.log(`\n5. KIỂM TRA RLS: User B cố ý truy vấn trực tiếp ID bữa ăn của User A (${mealAId}):`);
    const { data: targetMealForB, error: errTargetB } = await clientB
      .from('meal_logs')
      .select('*')
      .eq('id', mealAId);

    console.log(`   -> Kết quả:`, targetMealForB);
    if (targetMealForB && targetMealForB.length > 0) {
      console.error('   ❌ NGUY HIỂM: User B lấy được dữ liệu cụ thể của User A!');
    } else {
      console.log('   ✅ BẢO MẬT: Kết quả rỗng ([]) - User B không thể truy vấn ID của User A.');
    }

    console.log(`\n6. KIỂM TRA RLS: User B cố ý UPDATE bữa ăn của User A:`);
    const { data: updateRes, error: errUpdateB } = await clientB
      .from('meal_logs')
      .update({ food_name: 'Bị User B hack' })
      .eq('id', mealAId)
      .select();

    if (errUpdateB) {
      console.log('   -> Lỗi từ chối:', errUpdateB.message);
    } else if (!updateRes || updateRes.length === 0) {
      console.log('   ✅ BẢO MẬT: Không thể update, 0 dòng bị ảnh hưởng.');
    } else {
      console.error('   ❌ NGUY HIỂM: User B update được dữ liệu của User A!');
    }

    console.log(`\n7. KIỂM TRA RLS: User B cố ý DELETE bữa ăn của User A:`);
    const { data: deleteRes, error: errDeleteB } = await clientB
      .from('meal_logs')
      .delete()
      .eq('id', mealAId)
      .select();

    if (errDeleteB) {
      console.log('   -> Lỗi từ chối:', errDeleteB.message);
    } else if (!deleteRes || deleteRes.length === 0) {
      console.log('   ✅ BẢO MẬT: Không thể delete, 0 dòng bị ảnh hưởng.');
    } else {
      console.error('   ❌ NGUY HIỂM: User B xóa được dữ liệu của User A!');
    }
  }

  console.log(`\n8. KIỂM TRA RLS BẢNG PROFILES: User B đọc profiles của User A:`);
  const { data: profileAForB, error: errProfB } = await clientB
    .from('profiles')
    .select('*')
    .eq('user_id', userA.id);

  console.log(`   -> Kết quả truy vấn profile A của B:`, profileAForB);
  if (profileAForB && profileAForB.length > 0) {
    console.error('   ❌ NGUY HIỂM: User B đọc được profile của User A!');
  } else {
    console.log('   ✅ BẢO MẬT: User B KHÔNG đọc được profile của User A.');
  }

  console.log('\n=== KẾT THÚC TEST RLS ===');
}

runRlsTest();
