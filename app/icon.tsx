import { ImageResponse } from 'next/og';

export const size = {
  width: 256,
  height: 256,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          position: 'relative',
        }}
      >
        {/* Placa base circular metálica oscura */}
        <div
          style={{
            position: 'absolute',
            width: '236px',
            height: '236px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #24242e 0%, #0a0a0f 60%, #020204 100%)',
            border: '7px solid #f59e0b',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Anillo de precisión interior discontinuo dorado */}
          <div
            style={{
              position: 'absolute',
              width: '206px',
              height: '206px',
              borderRadius: '50%',
              border: '2px dashed rgba(245, 158, 11, 0.4)',
            }}
          />

          {/* Copa de cóctel de neón dorado */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              width: '180px',
              height: '180px',
              marginTop: '-10px',
            }}
          >
            {/* Cáliz de la copa (V dorada con líquido naranja neón) */}
            <div
              style={{
                width: '0',
                height: '0',
                borderLeft: '48px solid transparent',
                borderRight: '48px solid transparent',
                borderTop: '64px solid #d97706',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Líquido interno de cóctel brillante */}
              <div
                style={{
                  position: 'absolute',
                  top: '-60px',
                  width: '0',
                  height: '0',
                  borderLeft: '40px solid transparent',
                  borderRight: '40px solid transparent',
                  borderTop: '54px solid #f59e0b',
                }}
              />
            </div>

            {/* Tallo de la copa */}
            <div
              style={{
                width: '8px',
                height: '56px',
                background: 'linear-gradient(to bottom, #f59e0b, #b45309)',
                marginTop: '-2px',
              }}
            />

            {/* Base de la copa */}
            <div
              style={{
                width: '56px',
                height: '7px',
                borderRadius: '3px',
                background: 'linear-gradient(to right, #f59e0b, #b45309)',
              }}
            />

            {/* Aceituna decorativa verde con palillo rojo */}
            <div
              style={{
                position: 'absolute',
                top: '40px',
                right: '48px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                border: '1.5px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: '#dc2626',
                }}
              />
            </div>
          </div>
        </div>

        {/* Destellos de estrellas premium en los costados */}
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '120px',
            width: '12px',
            height: '12px',
            background: '#f59e0b',
            clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: '120px',
            width: '12px',
            height: '12px',
            background: '#f59e0b',
            clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
